#!/usr/bin/env bash
# Delta applied to credential-free android-build-tools-v3 before any app checkout.
set -Eeuo pipefail
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ANDROID_HOME=/home/user/android-sdk ANDROID_SDK_ROOT=/home/user/android-sdk
export PATH="/home/user/.bun/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH" COREPACK_HOME=/home/user/.cache/node/corepack COREPACK_ENABLE_DOWNLOAD_PROMPT=0
exec > >(TZ=UTC awk '{ print strftime("[%Y-%m-%dT%H:%M:%SZ]"), $0; fflush() }' >> /home/user/template-upgrade.log) 2>&1
trap 'rc=$?; if [ "$rc" -eq 0 ]; then echo SUCCESS; else echo ERROR; fi' EXIT
sdkmanager --install 'platforms;android-35' 'platforms;android-37.0' 'build-tools;37.0.0'
# Older sdkmanager/restored filesystems can leave an incomplete package directory.
if [ ! -x "$ANDROID_HOME/build-tools/37.0.0/aapt2" ]; then
  tools_archive=$(mktemp /tmp/android-tools37.XXXXXX.zip)
  tools_stage=$(mktemp -d /tmp/android-tools37.XXXXXX)
  curl -fsSL https://dl.google.com/android/repository/build-tools_r37_linux.zip -o "$tools_archive"
  printf '70954e99f4c3d9d46ee70fa32624672fe7cd6ebe  %s\n' "$tools_archive" | sha1sum -c -
  unzip -q "$tools_archive" -d "$tools_stage"
  test -s "$tools_stage/android-37.0/aapt2"
  mkdir -p "$ANDROID_HOME/build-tools/37.0.0"
  cp -a "$tools_stage/android-37.0/." "$ANDROID_HOME/build-tools/37.0.0/"
  rm -rf "$tools_archive" "$tools_stage"
fi
sudo npm install -g --prefix /opt/corepack corepack@0.36.0
sudo ln -sf /opt/corepack/bin/corepack /usr/local/bin/corepack
for manager in pnpm@10.12.3 pnpm@11.23.0 yarn@4.9.1; do corepack "$manager" --version; done
BUN_INSTALL=/home/user/.bun-1.3.10 bash -c 'curl -fsSL https://bun.sh/install | bash -s -- bun-v1.3.10'
/home/user/.bun-1.3.10/bin/bun --version | grep -Fx 1.3.10
for platform in android-35 android-36 android-37.0; do test -d "$ANDROID_HOME/platforms/$platform"; done
for version in 35.0.0 36.0.0 37.0.0; do "$ANDROID_HOME/build-tools/$version/aapt2" version; done
printf '%s\n' 'v4: v3 public tools and dependency caches plus Android platforms 35/37.0, build-tools 37.0.0, Corepack 0.36.0 with pinned public package managers, alternate Bun 1.3.10. No app source or credentials.' > /opt/android-toolchain/v4.txt
