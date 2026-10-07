#!/usr/bin/env bash
set -Eeuo pipefail
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -qq && sudo apt-get install -y -qq openjdk-17-jdk-headless unzip curl
curl -fsSL https://bun.sh/install | bash -s -- bun-v1.4.2
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ANDROID_HOME=/home/user/android-sdk ANDROID_SDK_ROOT=/home/user/android-sdk PATH="/home/user/.bun/bin:/home/user/android-sdk/cmdline-tools/latest/bin:/home/user/android-sdk/platform-tools:$PATH"
mkdir -p "$ANDROID_HOME/cmdline-tools"
curl -fsSLo /tmp/android-commandline-tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip -q /tmp/android-commandline-tools.zip -d "$ANDROID_HOME/cmdline-tools"
mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
set +o pipefail; yes | sdkmanager --licenses >/dev/null; set -o pipefail
sdkmanager 'platform-tools' 'platforms;android-36' 'build-tools;35.0.0' 'build-tools;36.0.0' 'ndk;27.1.12297006' 'cmake;3.30.5'
sudo tee /etc/profile.d/android-build-tools.sh >/dev/null <<'EOF'
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=/home/user/android-sdk
export ANDROID_SDK_ROOT=/home/user/android-sdk
export PATH="/home/user/.bun/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
EOF
source /etc/profile.d/android-build-tools.sh
bun --version; java -version; "$ANDROID_HOME/build-tools/35.0.0/aapt2" version; test -d "$ANDROID_HOME/platforms/android-36"; test -d "$ANDROID_HOME/ndk/27.1.12297006"; test -d "$ANDROID_HOME/cmake/3.30.5"
