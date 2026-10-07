#!/usr/bin/env bash
set -Eeuo pipefail

# Inputs are injected by the generic VM template: WORKLOAD_ID, EXPO_TOKEN,
# BENCHMARK_UPLOAD_COLD_URL, BENCHMARK_UPLOAD_WARM_URL, and BENCHMARK_SUPPORT_DIR.
# EXPO_TOKEN is consumed only from the inherited environment; this script never reads it from disk.
: "${WORKLOAD_ID:?}" "${EXPO_TOKEN:?}" "${BENCHMARK_UPLOAD_COLD_URL:?}" "${BENCHMARK_UPLOAD_WARM_URL:?}" "${BENCHMARK_SUPPORT_DIR:?}"

output="${BENCHMARK_OUTPUT_DIR:-/home/user/benchmark}"
source="${BENCHMARK_SOURCE_DIR:-/home/user/src}"
phase="$output/phase"
mkdir -p "$output"
export GRADLE_USER_HOME="${BENCHMARK_GRADLE_USER_HOME:-/home/user/.gradle}" npm_config_cache="${BENCHMARK_NPM_CACHE:-/home/user/.npm}" BUN_INSTALL_CACHE_DIR="${BENCHMARK_BUN_CACHE:-/home/user/.bun/install/cache}"
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=/home/user/android-sdk ANDROID_SDK_ROOT=/home/user/android-sdk
export PATH="$ANDROID_HOME/cmdline-tools/22.0/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
export PATH="/opt/corepack/bin:/opt/node-v24.19.0-linux-x64/bin:$PATH"
export COREPACK_HOME="${BENCHMARK_COREPACK_HOME:-/tmp/benchmark-corepack}"
if [[ -s /opt/android-toolchain/package-managers.tgz ]]; then
  corepack install --global --cache-only /opt/android-toolchain/package-managers.tgz
fi
mkdir -p "$GRADLE_USER_HOME"
mkdir -p "$GRADLE_USER_HOME/init.d"
cp "$BENCHMARK_SUPPORT_DIR/gradle-task-telemetry.init.gradle" "$GRADLE_USER_HOME/init.d/public-task-telemetry.init.gradle"
cat >>"$GRADLE_USER_HOME/gradle.properties" <<'EOF'
org.gradle.workers.max=6
org.gradle.caching=true
org.gradle.parallel=true
org.gradle.jvmargs=-Xmx4096m -Dfile.encoding=UTF-8
kotlin.daemon.jvmargs=-Xmx1024m
EOF

trap 'rc=$?; [[ -n "${sampler:-}" ]] && kill "$sampler" 2>/dev/null || true; if [[ "$rc" -eq 0 ]]; then echo SUCCESS; else echo ERROR; fi' EXIT

corepack_run() {
  command -v corepack >/dev/null 2>&1 || { echo 'Corepack is unavailable in the VM template' >&2; return 69; }
  corepack "$@"
}

pnpm_pinned() {
  local version=$1
  if corepack_run pnpm@"$version" --version 2>/dev/null | grep -Fx "$version" >/dev/null; then return 0; fi
  rm -rf "$COREPACK_HOME/v1/pnpm/$version"
  corepack install --global "pnpm@$version"
  corepack_run pnpm@"$version" --version | grep -Fx "$version" >/dev/null
}

case "$WORKLOAD_ID" in
  bluesky-social-app) repo=https://github.com/bluesky-social/social-app; sha=ce7bd05d5a1fa7464cccedab9ef2b77853bef1c0; project="$source";;
  expo-forge-mobile) repo=https://github.com/abed42/expo-forge; sha=3f88072e2233b988b265526176de62e4f211ef4e; project="$source/apps/mobile";;
  expo-with-pdf) repo=https://github.com/expo/examples; sha=76a1dd12978a7ba54b0e318cec01a8578db3b0c0; project="$source/with-pdf";;
  react-native-paper-example) repo=https://github.com/callstack/react-native-paper; sha=4ffc20ae4ac463cff70f50e22bc627531ec59467; project="$source/example";;
  obytes-template) repo=https://github.com/obytes/react-native-template-obytes; sha=fd9b358ed11913d2a49fd9ffa6582fe03ba130e7; project="$source";;
  *) echo "Unknown public workload: $WORKLOAD_ID" >&2; exit 64;;
esac

echo clone >"$phase"
if [[ "${BENCHMARK_SKIP_CLONE:-0}" != 1 ]]; then
  git clone --depth 1 "$repo" "$source"
  git -C "$source" fetch --depth 1 origin "$sha"
  git -C "$source" checkout --detach "$sha"
fi

echo install >"$phase"
case "$WORKLOAD_ID" in
  bluesky-social-app) pnpm_pinned 11.23.0; (cd "$project" && corepack_run pnpm@11.23.0 install --frozen-lockfile --store-dir /tmp/benchmark-pnpm-store --package-import-method copy);;
  expo-forge-mobile)
    forge_bun="${BENCHMARK_FORGE_BUN:-/usr/local/bin/bun}"
    [[ -x "$forge_bun" ]] || { echo 'Bun 1.4.2 missing from template' >&2; exit 65; }
    [[ "$($forge_bun --version)" == 1.4.2 ]] || { echo 'Bun 1.4.2 unavailable' >&2; exit 65; }
    export BUN_INSTALL_CACHE_DIR="${BENCHMARK_FORGE_BUN_CACHE:-/tmp/benchmark-forge-bun-cache}"
    (cd "$source" && "$forge_bun" install --backend=copyfile --frozen-lockfile);;
  expo-with-pdf) (cd "$project" && npm install);;
  react-native-paper-example) (cd "$source" && corepack_run yarn@4.9.1 install --immutable);;
  obytes-template) pnpm_pinned 10.12.3; (cd "$project" && CI=1 corepack_run pnpm@10.12.3 install --frozen-lockfile --store-dir /tmp/benchmark-pnpm-store --package-import-method copy);;
esac

if [[ "${BENCHMARK_SKIP_OVERLAY:-0}" != 1 ]]; then
  node "$BENCHMARK_SUPPORT_DIR/apply-eas-preview-overlay.mjs" "$project" "$BENCHMARK_SUPPORT_DIR/projects.json" "$WORKLOAD_ID" >"$output/overlay.json"
fi
if [[ "$WORKLOAD_ID" == obytes-template ]]; then
  export EXPO_NO_DOTENV=1 EXPO_PUBLIC_APP_ENV=preview EXPO_PUBLIC_API_URL=https://example.invalid
fi

if [[ "${BENCHMARK_SKIP_BUILD:-0}" == 1 ]]; then echo installer-validated >"$phase"; exit 0; fi
node "$BENCHMARK_SUPPORT_DIR/public-eas-sampler.mjs" "$output/metrics.ndjson" "$phase" & sampler=$!
build() {
  local cache=$1 artifact="$output/$1.apk" start end upload_start upload_end url_var url
  echo "$cache" >"$phase"; export BUILD_TELEMETRY_FILE="$output/$cache-tasks.ndjson"; start=$(date +%s%3N); printf '%s\n' "$start" >"$output/$cache.start"
  case "$WORKLOAD_ID" in
    bluesky-social-app) (cd "$project" && corepack_run pnpm@11.23.0 exec eas build --platform android --profile preview --local --non-interactive --output "$artifact");;
    expo-forge-mobile) (cd "$project" && "$forge_bun" x eas-cli@24.11.0 build --platform android --profile preview --local --non-interactive --output "$artifact");;
    *) (cd "$project" && bun x eas-cli@24.11.0 build --platform android --profile preview --local --non-interactive --output "$artifact");;
  esac
  test -s "$artifact"; end=$(date +%s%3N); printf '%s\n' "$end" >"$output/$cache.end"; sha256sum "$artifact" >"$output/$cache.sha256"
  url_var="BENCHMARK_UPLOAD_${cache^^}_URL"; url=${!url_var}; upload_start=$(date +%s%3N); printf '%s\n' "$upload_start" >"$output/$cache.upload.start"
  curl --fail --silent --show-error --max-time 115 --upload-file "$artifact" "$url"
  upload_end=$(date +%s%3N); printf '%s\n' "$upload_end" >"$output/$cache.upload.end"
  node -e 'const fs=require("fs"),crypto=require("crypto"),[o,c]=process.argv.slice(1),b=fs.readFileSync(`${o}/${c}.apk`);fs.writeFileSync(`${o}/${c}.receipt`,JSON.stringify({bytes:b.length,sha256:crypto.createHash("sha256").update(b).digest("hex"),buildStart:Number(fs.readFileSync(`${o}/${c}.start`)),buildEnd:Number(fs.readFileSync(`${o}/${c}.end`)),uploadStart:Number(fs.readFileSync(`${o}/${c}.upload.start`)),uploadEnd:Number(fs.readFileSync(`${o}/${c}.upload.end`))}));' "$output" "$cache"
}

cleanup_build_daemons() {
  local pids attempt
  pids="$(pgrep -f 'org\.gradle\.launcher\.daemon\.bootstrap\.GradleDaemon|org\.jetbrains\.kotlin\.daemon\.KotlinCompileDaemon' || true)"
  [[ -z "$pids" ]] && return 0
  kill $pids || true
  for attempt in {1..10}; do
    sleep 1
    pids="$(pgrep -f 'org\.gradle\.launcher\.daemon\.bootstrap\.GradleDaemon|org\.jetbrains\.kotlin\.daemon\.KotlinCompileDaemon' || true)"
    [[ -z "$pids" ]] && return 0
  done
  echo 'Gradle/Kotlin daemon cleanup did not complete before warm build' >&2
  return 70
}

build cold
cleanup_build_daemons
build warm
echo complete >"$phase"
