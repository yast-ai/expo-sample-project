export const setupScript = String.raw`#!/usr/bin/env bash
set -Eeuo pipefail
exec > >(TZ=UTC awk '{ print strftime("[%Y-%m-%dT%H:%M:%SZ]"), $0; fflush() }' >> /home/user/build.log) 2>&1
trap 'code=$?; if [ "$code" -eq 0 ]; then echo SUCCESS; else echo ERROR; fi' EXIT
export EXPO_TOKEN BUN_INSTALL_CACHE_DIR=/tmp/bun-cache JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ANDROID_HOME=/home/user/android-sdk ANDROID_SDK_ROOT=/home/user/android-sdk PATH="/home/user/.bun/bin:/home/user/android-sdk/cmdline-tools/latest/bin:/home/user/android-sdk/platform-tools:$PATH"
git clone --depth 1 https://github.com/yast-ai/expo-sample-project.git /tmp/app
cd /tmp/app
bun install --frozen-lockfile --backend=copyfile
echo IN_PROGRESS
node node_modules/eas-cli/bin/run build --local --platform android --profile preview --non-interactive --output /home/user/app.apk
test -s /home/user/app.apk
`;
