#!/usr/bin/env bash
# Cold-only EAS22 runner. The orchestrator provides a clean checkout and starts this script.
set -Eeuo pipefail
project="${1:?project path required}"; : "${COLD_STRATEGY_B64:?COLD_STRATEGY_B64 required}"
output=/home/user/benchmark-cold; work=/tmp/cold-eas; cache=/tmp/cold-gradle; prepared=/tmp/cold-prepared
mkdir -p "$output"; test -f /tmp/cold-task.gradle; test -f /tmp/cold-sample.mjs; test -x /opt/eas22/bin/eas
case "$(/opt/eas22/bin/eas --version)" in eas-cli/22.*) ;; *) echo ERROR > "$output/cold.status"; exit 64;; esac
test "$(bun --version)" = 1.4.2
node - "$COLD_STRATEGY_B64" > "$output/strategy.env" <<'JS'
const s=JSON.parse(Buffer.from(process.argv[2],'base64').toString()), id=String(s.id||'A').toUpperCase();
if(!['A','B','C','D'].includes(id))throw Error('strategy must be A-D');
const out={id,workers:Number(s.workers??6),heap:Number(s.heapMiB??4096),metro:Number(s.metroWorkers??4),pch:!!s.pch,ninja:Number(s.ninjaJobs??0)};
if(![4,6,8].includes(out.workers)||out.heap!==4096||out.metro!==4||![0,4].includes(out.ninja))throw Error('invalid cold strategy');
for(const[k,v]of Object.entries(out))console.log(`export ${k.toUpperCase()}=${JSON.stringify(String(v))}`);
JS
source "$output/strategy.env"
[[ "$ID" == A && "$PCH" == false && "$NINJA" == 0 || "$ID" == B && "$PCH" == true && "$NINJA" == 0 || "$ID" == C && "$PCH" == false && "$NINJA" == 4 || "$ID" == D && "$PCH" == true && "$NINJA" == 4 ]] || { echo ERROR > "$output/cold.status"; exit 65; }
if [ "$(basename "$project")" = mobile ] && [ -f "$project/../../package.json" ]; then repo=$(cd "$project/../.." && pwd); app_rel=apps/mobile; else repo="$project"; app_rel=.; fi
rm -rf "$work" "$cache" "$prepared"; mkdir -p "$cache/caches" "$cache/wrapper" "$cache/init.d" "$prepared"
cp -a /home/user/.gradle/caches/modules-2 "$cache/caches/"; cp -a /home/user/.gradle/wrapper/dists "$cache/wrapper/"
rsync -a --delete --exclude node_modules "$repo/" "$prepared/"; app="$prepared/$app_rel"
export BUN_INSTALL_CACHE_DIR=/tmp/cold-bun npm_config_cache=/tmp/cold-npm
test -f /tmp/cold-prepare.mjs; node /tmp/cold-prepare.mjs "$app"
export GRADLE_USER_HOME="$cache" npm_config_cache=/tmp/cold-npm BUN_INSTALL_CACHE_DIR=/tmp/cold-bun EAS_LOCAL_BUILD_SKIP_CLEANUP=1 EAS_NO_VCS=1 EAS_PROJECT_ROOT="$prepared" CI=1 NODE_OPTIONS=--max-old-space-size=2048 BUILD_TELEMETRY_FILE="$output/tasks-cold.ndjson" EXPO_USE_ANDROID_PRECOMPILED_HEADERS="$([ "$PCH" = true ] && echo 1 || echo 0)"
printf 'org.gradle.workers.max=%s\norg.gradle.parallel=true\norg.gradle.caching=true\norg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=2048m -Xlog:gc*:file=/home/user/benchmark-cold/gc-%%p.log:time,uptime,level,tags\nkotlin.compiler.execution.strategy=in-process\n' "$WORKERS" > "$cache/gradle.properties"
cp /tmp/cold-task.gradle "$cache/init.d/task-telemetry.gradle"
cat > "$cache/init.d/native.gradle" <<'GRADLE'
allprojects { p -> ['com.android.application','com.android.library'].each { id -> p.plugins.withId(id) { p.extensions.getByName('android').defaultConfig.externalNativeBuild.cmake.arguments.add('-DCCACHE_FOUND=OFF') } } }
GRADLE
if [ "$NINJA" = 4 ]; then ninja=$(find "$ANDROID_HOME/cmake" -type f -path '*/bin/ninja' -perm -111 -print -quit); printf '#!/bin/sh\nexec %q -j 4 "$@"\n' "$ninja" > /tmp/cold-ninja; chmod 755 /tmp/cold-ninja; cat > "$cache/init.d/ninja.gradle" <<'GRADLE'
allprojects { p -> ['com.android.application','com.android.library'].each { id -> p.plugins.withId(id) { p.extensions.getByName('android').defaultConfig.externalNativeBuild.cmake.arguments.add('-DCMAKE_MAKE_PROGRAM=/tmp/cold-ninja') } } }
GRADLE
fi
node - "$app/eas.json" "$METRO" <<'JS'
const fs=require('fs'),[p,metro]=process.argv.slice(2),e=JSON.parse(fs.readFileSync(p));e.cli={...(e.cli||{}),version:'22.0.0'};e.build.preview.android={...(e.build.preview.android||{}),gradleCommand:':app:assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64 --no-daemon --build-cache -Pkotlin.compiler.execution.strategy=in-process'};fs.writeFileSync(p,JSON.stringify(e,null,2));const m=p.replace(/eas\.json$/,'metro.config.js'),original=fs.existsSync(m)?fs.readFileSync(m,'utf8'):"const {getDefaultConfig}=require('expo/metro-config'); module.exports=getDefaultConfig(__dirname);\n";fs.writeFileSync(m,`const config=(()=>{${original};return module.exports.default||module.exports;})();\nconfig.maxWorkers=${metro};module.exports=config;\n`);
JS
node /tmp/cold-sample.mjs "$output/metrics.ndjson" "$output/phase" "$output/processes.ndjson" & sampler=$!
finish(){ rc=$?; kill "$sampler" 2>/dev/null || true; wait "$sampler" 2>/dev/null || true; test -s "$output/cold.end" || date +%s%3N > "$output/cold.end"; if [ "$rc" != 0 ]; then echo ERROR > "$output/cold.status"; fi; exit "$rc"; }; trap finish EXIT
node - "$output/hardware.json" "$ID" "$WORKERS" "$PCH" "$NINJA" <<'JS'
const fs=require('fs'),os=require('os');const [file,id,workers,pch,ninja]=process.argv.slice(2);let quota=null;try{quota=fs.readFileSync('/sys/fs/cgroup/cpu.max','utf8').trim()}catch{}fs.writeFileSync(file,JSON.stringify({strategy:id,workers:+workers,heapMiB:4096,metroWorkers:4,pchRequested:pch==='true',ninjaJobs:+ninja,cpus:os.cpus().length,platform:process.platform,arch:process.arch,cgroupCpuMax:quota}));
JS
printf install > "$output/phase"; (cd "$prepared"; { date -u +%FT%TZ; bun install --frozen-lockfile --backend=copyfile; }) > >(awk '{print strftime("[%Y-%m-%dT%H:%M:%SZ]"),$0;fflush()}' | tee "$output/build.log") 2>&1
printf cold > "$output/phase"; date +%s%3N > "$output/cold.start"; set +e; (cd "$app"; EAS_LOCAL_BUILD_WORKINGDIR="$work" /opt/eas22/bin/eas build --local --platform android --profile preview --non-interactive --output "$output/cold.apk") > >(awk '{print strftime("[%Y-%m-%dT%H:%M:%SZ]"),$0;fflush()}' | tee -a "$output/build.log") 2>&1; rc=$?; set -e; date +%s%3N > "$output/cold.end"; [ "$rc" = 0 ] || exit "$rc"
test -s "$output/cold.apk"; unzip -l "$output/cold.apk" > "$output/apk-files.txt"; for abi in armeabi-v7a arm64-v8a x86 x86_64; do grep -q "lib/$abi/" "$output/apk-files.txt" || exit 71; done
find "$work" \( -name rules.ninja -o -name build.ninja -o -name CMakeConfigureLog.yaml -o -name CMakeOutput.log \) -type f | while read -r f; do printf '\n--- %s ---\n' "$f"; grep -Ei 'precompiled|pch|cold-ninja|command =|app/build/generated' "$f" 2>/dev/null || true; done > "$output/native-evidence.txt"
find "$work" \( -name .ninja_log -o -iname '*metadata*.json' \) -type f -printf '%p %s\n' > "$output/native-files.txt" 2>/dev/null || true
mkdir -p "$output/native-archive"; find "$work" \( -name rules.ninja -o -name build.ninja -o -name CMakeConfigureLog.yaml -o -name CMakeOutput.log -o -name CMakeCache.txt -o -name .ninja_log -o -name '*_timing.txt' -o -name '*configure*command*' -o -name '*configure*stdout*' -o -name '*configure*stderr*' -o -iname '*metadata*.json' \) -type f | while read -r f; do dest="$output/native-archive/${f#$work/}"; mkdir -p "$(dirname "$dest")"; cp "$f" "$dest"; done
app_pch=false; find "$work" -type f -path '*/android/app/src/main/jni/pch.h' -print -quit | grep -q . && app_pch=true
app_ninja=false; find "$work" -path '*/android/app/.cxx/*/build.ninja' -type f -exec grep -Eil 'pch|precompiled' {} + 2>/dev/null | grep -q . && app_ninja=true
pch_actual=false; "$app_pch" && "$app_ninja" && pch_actual=true; node - "$output/native-evidence.json" "$PCH" "$pch_actual" "$NINJA" "$app_pch" "$app_ninja" <<'JS'
const fs=require('fs'),[file,requested,verified,ninja,header,ninjaFile]=process.argv.slice(2);fs.writeFileSync(file,JSON.stringify({pchRequested:requested==='true',pchVerified:verified==='true',appGeneratedPchHeader:header==='true',appBuildNinjaPch:ninjaFile==='true',ninjaJobs:+ninja,evidenceFile:'native-evidence.txt',nativeFiles:'native-files.txt'}));
JS
[ "$PCH" = false ] || "$pch_actual" || { echo PCH_INERT > "$output/cold.status"; exit 72; }
node - "$output" "$ID" "$PCH" "$pch_actual" "$NINJA" <<'JS'
const fs=require('fs'),crypto=require('crypto'),[o,id,pch,verified,ninja]=process.argv.slice(2),b=fs.readFileSync(`${o}/cold.apk`),files=fs.readFileSync(`${o}/apk-files.txt`,'utf8'),architectures=['armeabi-v7a','arm64-v8a','x86','x86_64'].filter(abi=>files.includes(`lib/${abi}/`));fs.writeFileSync(`${o}/cold.receipt`,JSON.stringify({strategy:id,pchRequested:pch==='true',pchVerified:verified==='true',ninjaJobs:+ninja,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex'),architectures,buildStartedAt:+fs.readFileSync(`${o}/cold.start`),buildCompletedAt:Date.now()}));
JS
echo SUCCESS > "$output/cold.status"
