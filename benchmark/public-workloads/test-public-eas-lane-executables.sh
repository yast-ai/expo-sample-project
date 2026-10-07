#!/usr/bin/env bash
set -Eeuo pipefail

root="$(cd "$(dirname "$0")" && pwd)"
temp="$(mktemp -d /private/tmp/public-eas-lane-stub.XXXXXX)"
trap 'rm -rf "$temp"' EXIT
mkdir -p "$temp/bin" "$temp/src/apps/mobile" "$temp/src/with-pdf" "$temp/src/example" "$temp/out" "$temp/support"
cp "$root/../../research/gradle-task-telemetry.init.gradle" "$temp/support/gradle-task-telemetry.init.gradle"
log="$temp/calls.log"

cat >"$temp/bin/corepack" <<'EOF'
#!/usr/bin/env bash
if [[ "$*" == *'--version'* ]]; then
  [[ "$*" == *'pnpm@11.23.0'* ]] && echo 11.23.0
  [[ "$*" == *'pnpm@10.12.3'* ]] && echo 10.12.3
  exit 0
fi
printf 'corepack|%s|%s\n' "$PWD" "$*" >>"$STUB_LOG"
EOF
cat >"$temp/bin/npm" <<'EOF'
#!/usr/bin/env bash
printf 'npm|%s|%s\n' "$PWD" "$*" >>"$STUB_LOG"
EOF
cat >"$temp/forge-bun" <<'EOF'
#!/usr/bin/env bash
if [[ "$1" == --version ]]; then echo 1.4.2; exit 0; fi
printf 'forge-bun|%s|%s\n' "$PWD" "$*" >>"$STUB_LOG"
EOF
chmod +x "$temp/bin/corepack" "$temp/bin/npm" "$temp/forge-bun"

run_lane() {
  local id=$1
  PATH="$temp/bin:$PATH" STUB_LOG="$log" WORKLOAD_ID="$id" EXPO_TOKEN=stub BENCHMARK_UPLOAD_COLD_URL=https://example.invalid/cold BENCHMARK_UPLOAD_WARM_URL=https://example.invalid/warm BENCHMARK_SUPPORT_DIR="$temp/support" BENCHMARK_SOURCE_DIR="$temp/src" BENCHMARK_OUTPUT_DIR="$temp/out/$id" BENCHMARK_GRADLE_USER_HOME="$temp/gradle/$id" BENCHMARK_NPM_CACHE="$temp/npm/$id" BENCHMARK_BUN_CACHE="$temp/bun/$id" BENCHMARK_COREPACK_HOME="$temp/corepack" BENCHMARK_FORGE_BUN="$temp/forge-bun" BENCHMARK_SKIP_CLONE=1 BENCHMARK_SKIP_OVERLAY=1 BENCHMARK_SKIP_BUILD=1 bash "$root/public-eas-lane.sh" >/dev/null
}

for id in bluesky-social-app expo-forge-mobile expo-with-pdf react-native-paper-example obytes-template; do run_lane "$id"; done

grep -F "corepack|$temp/src|pnpm@11.23.0 install --frozen-lockfile" "$log"
grep -F "forge-bun|$temp/src|install --backend=copyfile --frozen-lockfile" "$log"
grep -F "npm|$temp/src/with-pdf|install" "$log"
grep -F "corepack|$temp/src|yarn@4.9.1 install --immutable" "$log"
grep -F "corepack|$temp/src|pnpm@10.12.3 install --frozen-lockfile" "$log"
for id in bluesky-social-app expo-forge-mobile expo-with-pdf react-native-paper-example obytes-template; do
  properties="$temp/gradle/$id/gradle.properties"
  grep -Fx 'org.gradle.workers.max=6' "$properties"
  grep -Fx 'org.gradle.caching=true' "$properties"
  grep -Fx 'org.gradle.parallel=true' "$properties"
  grep -Fx 'org.gradle.jvmargs=-Xmx4096m -Dfile.encoding=UTF-8' "$properties"
  grep -Fx 'kotlin.daemon.jvmargs=-Xmx1024m' "$properties"
  test -f "$temp/gradle/$id/init.d/public-task-telemetry.init.gradle"
done
grep -F 'export BUILD_TELEMETRY_FILE="$output/$cache-tasks.ndjson"' "$root/public-eas-lane.sh"
grep -F 'cleanup_build_daemons' "$root/public-eas-lane.sh"
printf 'public-eas-lane executable installer cwd harness passed\n'
