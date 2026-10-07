export const setupScript = String.raw`#!/usr/bin/env bash
set -Eeuo pipefail
exec > >(TZ=UTC awk '{ print strftime("[%Y-%m-%dT%H:%M:%SZ]"), $0; fflush() }' >> /home/user/build.log) 2>&1
trap 'code=$?; if [ "$code" -eq 0 ]; then echo SUCCESS; else echo ERROR; fi' EXIT
export EXPO_TOKEN JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ANDROID_HOME=/home/user/android-sdk ANDROID_SDK_ROOT=/home/user/android-sdk PATH="/home/user/.bun/bin:$PATH"
sudo apt-get update -qq && sudo apt-get install -y -qq openjdk-17-jdk-headless unzip
curl -fsSL https://bun.sh/install | bash -s -- bun-v1.4.2
mkdir -p "$ANDROID_HOME/cmdline-tools"
curl -fsSLo /tmp/android.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip -q /tmp/android.zip -d "$ANDROID_HOME/cmdline-tools" && mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
set +o pipefail; yes | sdkmanager --licenses >/dev/null; set -o pipefail
sdkmanager 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0' 'ndk;27.1.12297006' 'cmake;3.30.5'
git clone --depth 1 https://github.com/yast-ai/expo-sample-project.git /home/user/app
cd /home/user/app
bun install --frozen-lockfile
echo IN_PROGRESS
./node_modules/.bin/eas build --local --platform android --profile preview --non-interactive --output /home/user/app.apk
test -s /home/user/app.apk
`;
