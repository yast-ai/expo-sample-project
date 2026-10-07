#!/usr/bin/env bash
set -Eeuo pipefail
project="$1"; workers="$2"; heap="$3"; warm_workers="$4"; warm_heap="$5"; output=/home/user/benchmark; work=/tmp/experiment-eas
mkdir -p "$output" /tmp/gradle-cache
export GRADLE_USER_HOME=/tmp/gradle-cache npm_config_cache=/tmp/npm-cache BUN_INSTALL_CACHE_DIR=/tmp/bun-cache EAS_LOCAL_BUILD_SKIP_CLEANUP=1
if [ ! -f "$ANDROID_HOME/build-tools/35.0.0/aapt2" ]; then sdkmanager --install 'build-tools;35.0.0' </dev/null; fi
chmod -R a+rX "$ANDROID_HOME/build-tools/35.0.0"
stat -c '%a %s %n' "$ANDROID_HOME/build-tools/35.0.0/aapt2"
file "$ANDROID_HOME/build-tools/35.0.0/aapt2"
for attempt in {1..20}; do if "$ANDROID_HOME/build-tools/35.0.0/aapt2" version; then break; fi; head -c 4 "$ANDROID_HOME/build-tools/35.0.0/aapt2" >/dev/null || true; sleep 1; done
"$ANDROID_HOME/build-tools/35.0.0/aapt2" version

node /tmp/sample.mjs "$output/metrics.ndjson" "$output/phase" & sampler=$!
trap 'kill "$sampler" 2>/dev/null || true' EXIT
cd "$project"
echo setup > "$output/phase"
bun install --frozen-lockfile --backend=copyfile
for cache in cold warm warm2; do
  date +%s%3N > "$output/$cache.trigger"
  next_workers="$workers"; next_heap="$heap"; if [ "$cache" != cold ]; then next_workers="$warm_workers"; next_heap="$warm_heap"; fi
  if [ "$cache" = warm ] && { [ "$workers" != "$warm_workers" ] || [ "$heap" != "$warm_heap" ]; }; then (cd "$work/build${project#/tmp/repo}/android" && ./gradlew --stop); fi
  rm -rf "$work"
  printf 'org.gradle.workers.max=%s\norg.gradle.parallel=true\norg.gradle.caching=true\norg.gradle.jvmargs=-Xmx%sm -XX:MaxMetaspaceSize=1024m -Xlog:gc:file=/tmp/gradle-gc-%%p.log:time,level,tags\nkotlin.daemon.jvmargs=-Xmx1024m\n' "$next_workers" "$next_heap" > "$GRADLE_USER_HOME/gradle.properties"
  echo "$cache" > "$output/phase"
  date +%s%3N > "$output/$cache.start"
  EAS_LOCAL_BUILD_WORKINGDIR="$work" node node_modules/eas-cli/bin/run build --local --platform android --profile preview --non-interactive --output "$output/$cache.apk"
  test -s "$output/$cache.apk"
  date +%s%3N > "$output/$cache.end"
  date +%s%3N > "$output/$cache.upload.start"
  url_name="BENCHMARK_UPLOAD_${cache^^}_URL"
  curl --fail --silent --show-error --max-time 115 --upload-file "$output/$cache.apk" "${!url_name}"
  date +%s%3N > "$output/$cache.upload.end"
  node - "$output" "$cache" <<'JS'
const fs=require('fs'),crypto=require('crypto'),[p,c]=process.argv.slice(2),b=fs.readFileSync(`${p}/${c}.apk`);fs.writeFileSync(`${p}/${c}.receipt`,JSON.stringify({bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex'),uploadStart:Number(fs.readFileSync(`${p}/${c}.upload.start`)),uploadEnd:Number(fs.readFileSync(`${p}/${c}.upload.end`))}));
JS
  echo SUCCESS > "$output/$cache.status"
done
