#!/usr/bin/env bash
set -Eeuo pipefail
project="$1"; profile="$2"; workers="$3"; output=/home/user/benchmark
mkdir -p "$output" /tmp/gradle-cache
export GRADLE_USER_HOME=/tmp/gradle-cache npm_config_cache=/tmp/npm-cache EAS_LOCAL_BUILD_SKIP_CLEANUP=1
printf 'org.gradle.workers.max=%s\norg.gradle.parallel=true\norg.gradle.caching=true\norg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m\nkotlin.daemon.jvmargs=-Xmx1024m\n' "$workers" > "$GRADLE_USER_HOME/gradle.properties"
node /tmp/repo/benchmark/sample.mjs "$output/metrics.ndjson" "$output/phase" & sampler=$!
trap 'rc=$?; kill "$sampler" 2>/dev/null || true; if [ "$rc" -eq 0 ]; then echo SUCCESS; else echo ERROR; fi' EXIT
cd "$project"
echo setup > "$output/phase"
bun install --frozen-lockfile --backend=copyfile
for cache in cold warm; do
  echo "$cache" > "$output/phase"
  date +%s%3N > "$output/$cache.start"
  extension=apk; if [ "$profile" = production ]; then extension=aab; fi
  EAS_LOCAL_BUILD_WORKINGDIR="$output/eas-$cache" node node_modules/eas-cli/bin/run build --local --platform android --profile "$profile" --non-interactive --output "$output/$cache.$extension" 2>&1 | TZ=UTC awk '{ print strftime("[%Y-%m-%dT%H:%M:%SZ]"), $0; fflush() }' | tee "$output/$cache.log"
  test -s "$output/$cache.$extension"
  date +%s%3N > "$output/$cache.end"
  echo SUCCESS > "$output/$cache.status"
done
