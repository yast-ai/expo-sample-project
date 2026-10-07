#!/usr/bin/env bash
set -Eeuo pipefail
project=/workspace
output=/output
workers=6
mkdir -p "$output" /cache/gradle /cache/bun /cache/eas
mkdir -p "$HOME"
export GRADLE_USER_HOME=/cache/gradle BUN_INSTALL_CACHE_DIR=/cache/bun EAS_LOCAL_BUILD_SKIP_CLEANUP=1
export ANDROID_HOME=/opt/android-sdk ANDROID_SDK_ROOT=/opt/android-sdk
export PATH=/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:$PATH
printf 'org.gradle.workers.max=%s\norg.gradle.parallel=true\norg.gradle.caching=true\norg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m\nkotlin.daemon.jvmargs=-Xmx1024m\n' "$workers" > "$GRADLE_USER_HOME/gradle.properties"
cd "$project"
git config --global --add safe.directory "$project"
bun install --frozen-lockfile --backend=copyfile
for cache in cold warm; do
  echo "$cache" > "$output/phase"
  rm -rf "/cache/eas/$cache"
  date +%s%3N > "$output/$cache.start"
  date +%s%3N > "$output/$cache.eas.start"
  EAS_LOCAL_BUILD_WORKINGDIR="/cache/eas/$cache" node node_modules/eas-cli/bin/run build --local --platform android --profile preview --non-interactive --output "$output/$cache.apk"
  date +%s%3N > "$output/$cache.eas.end"
  test -s "$output/$cache.apk"
  date +%s%3N > "$output/$cache.end"
  echo SUCCESS > "$output/$cache.status"
done
