#!/usr/bin/env bash
# Public-native V2 VM runner. The orchestrator clones/checks out the public project before invoking this.
set -Eeuo pipefail

render_props() {
  local file="$1" workers="$2" heap="$3"
  printf 'org.gradle.workers.max=%s\norg.gradle.parallel=true\norg.gradle.caching=true\norg.gradle.jvmargs=-Xmx%sm -XX:MaxMetaspaceSize=2048m -Xlog:gc*:file=/home/user/benchmark-v2/gc-%%p.log:time,uptime,level,tags\nkotlin.compiler.execution.strategy=in-process\n' "$workers" "$heap" > "$file"
}
if [ "${1:-}" = --fixture-test ]; then
  fixture=$(mktemp -d); render_props "$fixture/gradle.properties" 6 6144
  mkdir -p "$fixture/app"; printf '{"build":{"preview":{"android":{}}}}' > "$fixture/app/eas.json"; printf 'module.exports={resolver:{sourceExts:["js"]}};\n' > "$fixture/app/metro.config.js"
  node - "$fixture/app/eas.json" 4 <<'JS'
const fs=require('fs'),[p,metro]=process.argv.slice(2),e=JSON.parse(fs.readFileSync(p));e.cli={...(e.cli||{}),version:'22.0.0'};e.build.preview.android={...(e.build.preview.android||{}),gradleCommand:':app:assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64 --no-daemon --build-cache -Pkotlin.compiler.execution.strategy=in-process'};fs.writeFileSync(p,JSON.stringify(e));const m=p.replace(/eas\.json$/,'metro.config.js'),original=fs.readFileSync(m,'utf8');fs.writeFileSync(m,`const config=(()=>{${original};return module.exports.default||module.exports;})();\nconfig.maxWorkers=${metro};module.exports=config;\n`);
JS
  grep -q -- 'org.gradle.workers.max=6' "$fixture/gradle.properties" && grep -q -- '-Xmx6144m' "$fixture/gradle.properties" && grep -q -- 'gc-%p.log' "$fixture/gradle.properties" && grep -q -- 'arm64-v8a' "$fixture/app/eas.json" && node -e "const c=require('$fixture/app/metro.config.js');if(c.maxWorkers!==4||!c.resolver)process.exit(1)"
  rm -rf "$fixture"; echo 'v2 fixture PASS'; exit 0
fi

project="${1:?public native project path required}"
: "${V2_STRATEGY_B64:?V2_STRATEGY_B64 required}"
: "${V2_COLD_UPLOAD_URL:?V2_COLD_UPLOAD_URL required}"
: "${V2_WARM_UPLOAD_URL:?V2_WARM_UPLOAD_URL required}"
test -f /tmp/v2-sample.mjs; test -f /tmp/v2-task.gradle; test -x /opt/eas22/bin/eas
case "$(/opt/eas22/bin/eas --version)" in eas-cli/22.*) ;; *) echo 'expected EAS CLI 22' >&2; exit 64;; esac
test "$(bun --version)" = 1.4.2

output=/home/user/benchmark-v2
mkdir -p "$output"
node - "$V2_STRATEGY_B64" > "$output/strategy.env" <<'JS'
const s=JSON.parse(Buffer.from(process.argv[2],'base64').toString('utf8'));
const int=(n,d,ok)=>Number.isInteger(n??d)&&ok(n??d)?n??d:null;
const heap=s.heap??s.heapMiB??6144,warmHeap=s.warmHeap??s.warmHeapMiB??heap;
const v={id:String(s.id||'v2'),workers:int(s.workers,4,n=>[4,6,8].includes(n)),heap:int(heap,6144,n=>[4096,6144,8192].includes(n)),warmWorkers:int(s.warmWorkers,s.workers??4,n=>[4,6,8].includes(n)),warmHeap:int(warmHeap,heap,n=>[4096,6144,8192].includes(n)),metro:int(s.metroWorkers,4,n=>[2,4,8].includes(n)),ccache:!!s.ccache,ninja:int(s.ninjaJobs,0,n=>n>=0&&n<=16),docker:!!s.docker};
if(Object.values(v).some(x=>x===null)||!/^[a-z0-9-]+$/i.test(v.id))throw Error('invalid V2 strategy');
for(const[k,x]of Object.entries(v))console.log(`export ${k.toUpperCase()}=${JSON.stringify(String(x))}`);
JS
# shellcheck disable=SC1090
source "$output/strategy.env"
cache="/tmp/v2-gradle-${ID}"; work_root=/tmp/v2-eas
mkdir -p "$cache"; git -C "$project" rev-parse --is-inside-work-tree >/dev/null
if [ -n "$(ls -A "$cache")" ]; then echo 'V2 cache must start isolated and empty' >&2; exit 65; fi
mkdir -p "$cache/caches" "$cache/wrapper" "$cache/init.d" "$cache/tmp"
cp -a /home/user/.gradle/caches/modules-2 "$cache/caches/"
cp -a /home/user/.gradle/wrapper/dists "$cache/wrapper/"
export GRADLE_USER_HOME="$cache" npm_config_cache="/tmp/v2-npm-${ID}" BUN_INSTALL_CACHE_DIR="/tmp/v2-bun-${ID}" EAS_LOCAL_BUILD_SKIP_CLEANUP=1 NODE_OPTIONS=--max-old-space-size=2048
cp /tmp/v2-task.gradle "$GRADLE_USER_HOME/init.d/task-telemetry.gradle"
cat > "$GRADLE_USER_HOME/init.d/native.gradle" <<'GRADLE'
allprojects { p -> ['com.android.application','com.android.library'].each { id -> p.plugins.withId(id) { def args=p.extensions.getByName('android').defaultConfig.externalNativeBuild.cmake.arguments; args.add('-DCCACHE_FOUND=OFF'); if ((System.getenv('V2_NINJA_JOBS') ?: '0') != '0') args.add('-DCMAKE_MAKE_PROGRAM=/tmp/v2-ninja-wrapper') } } }
GRADLE
ninja_binary=$(find "$ANDROID_HOME/cmake" -type f -path '*/bin/ninja' -perm -111 -print -quit 2>/dev/null); test -n "$ninja_binary"
printf '#!/bin/sh\nexec %q -j "$V2_NINJA_JOBS" "$@"\n' "$ninja_binary" > /tmp/v2-ninja-wrapper
chmod 755 /tmp/v2-ninja-wrapper
node - "$project/eas.json" "$METRO" "$NINJA" <<'JS'
const fs=require('fs'),[p,metro,ninja]=process.argv.slice(2),e=JSON.parse(fs.readFileSync(p));
e.cli={...(e.cli||{}),version:'22.0.0'};e.build.preview.android={...(e.build.preview.android||{}),gradleCommand:':app:assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64 --no-daemon --build-cache -Pkotlin.compiler.execution.strategy=in-process'};fs.writeFileSync(p,JSON.stringify(e,null,2));
const m=p.replace(/eas\.json$/,'metro.config.js');const original=fs.existsSync(m)?fs.readFileSync(m,'utf8'):"const {getDefaultConfig}=require('expo/metro-config');module.exports=getDefaultConfig(__dirname);\n";fs.writeFileSync(m,`const config=(()=>{${original}; return module.exports.default||module.exports;})();\nconfig.maxWorkers=${metro}; module.exports=config;\n`);
JS
if [ "$CCACHE" = true ]; then test -x /usr/bin/ccache; export CMAKE_C_COMPILER_LAUNCHER=/usr/bin/ccache CMAKE_CXX_COMPILER_LAUNCHER=/usr/bin/ccache CCACHE_DIR="$output/ccache" CCACHE_BASEDIR="$work_root/build" CCACHE_COMPILERCHECK=content; fi
node /tmp/v2-sample.mjs "$output/metrics.ndjson" "$output/phase" >/dev/null 2>&1 & sampler=$!
trap 'kill "$sampler" 2>/dev/null || true' EXIT
cd "$project"; printf setup > "$output/phase"
printf '[%s] INSTALL_START\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee "$output/install.log"
bun install --frozen-lockfile --backend=copyfile > >(TZ=UTC awk '{print strftime("[%Y-%m-%dT%H:%M:%SZ]"),$0;fflush()}' | tee -a "$output/install.log") 2>&1
printf '[%s] INSTALL_END\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$output/install.log"
for cache_name in cold warm; do
  workers="$WORKERS"; heap="$HEAP"; [ "$cache_name" = warm ] && { workers="$WARMWORKERS"; heap="$WARMHEAP"; }
  work="$work_root"; rm -rf "$work"; mkdir -p "$work"
  [ "$CCACHE" = true ] && ccache --zero-stats || true
  render_props "$GRADLE_USER_HOME/gradle.properties" "$workers" "$heap"
  export BUILD_TELEMETRY_FILE="$output/tasks-$cache_name.ndjson" V2_NINJA_JOBS="$NINJA"
  printf '%s' "$cache_name" > "$output/phase"; date +%s%3N > "$output/$cache_name.trigger"; date +%s%3N > "$output/$cache_name.start"
  printf '[%s] EAS_START phase=%s epochMs=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$cache_name" "$(cat "$output/$cache_name.start")" | tee "$output/$cache_name.build.log"
  set +e
  EAS_LOCAL_BUILD_WORKINGDIR="$work" /opt/eas22/bin/eas build --local --platform android --profile preview --non-interactive --output "$output/$cache_name.apk" > >(TZ=UTC awk '{print strftime("[%Y-%m-%dT%H:%M:%SZ]"),$0;fflush()}' | tee -a "$output/$cache_name.build.log") 2>&1
  rc=$?; set -e; date +%s%3N > "$output/$cache_name.end"
  printf '[%s] EAS_END phase=%s epochMs=%s exitCode=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$cache_name" "$(cat "$output/$cache_name.end")" "$rc" | tee -a "$output/$cache_name.build.log"
  find "$work" -name rules.ninja -type f -exec grep -H 'ccache\|v2-ninja-wrapper' {} + > "$output/launchers-$cache_name.txt" 2>/dev/null || true
  printf 'ninjaWrapper=%s ninjaJobs=%s\n' "$ninja_binary" "$NINJA" >> "$output/launchers-$cache_name.txt"
  [ "$CCACHE" = true ] && ccache --show-stats --verbose > "$output/ccache-$cache_name.txt" 2>&1 || echo disabled > "$output/ccache-$cache_name.txt"
  if [ "$rc" -ne 0 ] || ! test -s "$output/$cache_name.apk"; then echo ERROR > "$output/$cache_name.status"; exit 70; fi
  mkdir -p "$output/gc-$cache_name"; cp -a "$output"/gc-*.log "$output/gc-$cache_name/" 2>/dev/null || true
  date +%s%3N > "$output/$cache_name.upload.start"; url_var="V2_${cache_name^^}_UPLOAD_URL"; upload_ok=false
  for retry in 1 2 3; do curl --fail --silent --show-error --max-time 115 --upload-file "$output/$cache_name.apk" "${!url_var}" && { upload_ok=true; break; } || sleep "$retry"; done
  date +%s%3N > "$output/$cache_name.upload.end"
  node - "$output" "$cache_name" "$upload_ok" <<'JS'
const fs=require('fs'),crypto=require('crypto'),[o,c,ok]=process.argv.slice(2),b=fs.readFileSync(`${o}/${c}.apk`);fs.writeFileSync(`${o}/${c}.receipt`,JSON.stringify({bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex'),uploadStart:Number(fs.readFileSync(`${o}/${c}.upload.start`)),uploadEnd:Number(fs.readFileSync(`${o}/${c}.upload.end`)),uploadOk:ok==='true'}));
JS
  [ "$upload_ok" = true ] || echo 'UPLOAD_ERROR retained; continuing warm' >> "$output/$cache_name.build.log"
  echo SUCCESS > "$output/$cache_name.status"
done
