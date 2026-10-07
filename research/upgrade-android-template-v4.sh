#!/usr/bin/env bash
# Prepared v4 recovery; restore verification and real build still required.
set -Eeuo pipefail
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ANDROID_HOME=/home/user/android-sdk ANDROID_SDK_ROOT=/home/user/android-sdk
export PATH="/home/user/.bun/bin:$ANDROID_HOME/cmdline-tools/22.0/bin:$ANDROID_HOME/platform-tools:$PATH" COREPACK_HOME=/tmp/template-corepack-preflight COREPACK_ENABLE_DOWNLOAD_PROMPT=0
exec > >(TZ=UTC awk '{ print strftime("[%Y-%m-%dT%H:%M:%SZ]"), $0; fflush() }' >> /home/user/template-upgrade.log) 2>&1
trap 'rc=$?; if [ "$rc" -eq 0 ]; then echo SUCCESS; else echo ERROR; fi' EXIT
if ! /home/user/.bun/bin/bun --version | grep -Fx 1.4.2 >/dev/null; then
  curl -fsSL https://bun.sh/install | bash -s -- bun-v1.4.2
fi
sudo ln -sf /home/user/.bun/bin/bun /usr/local/bin/bun
bun --version | grep -Fx 1.4.2
# Java CLI 22.0 is pinned; SDK37 is installed independently from verified archives.
if [ "$(cat "$ANDROID_HOME/cmdline-tools/22.0/.benchmark-version" 2>/dev/null || true)" != 15859902 ]; then
  cli_stage=$(mktemp -d /tmp/android-cli.XXXXXX)
  curl -fsSL https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip -o "$cli_stage/tools.zip"
  printf '040d3996a65543d22ec4bf73e4c37aa37a8d4af4  %s\n' "$cli_stage/tools.zip" | sha1sum -c -
  unzip -q "$cli_stage/tools.zip" -d "$cli_stage"
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  test ! -e "$ANDROID_HOME/cmdline-tools/22.0" || { echo 'Unexpected existing CLI22 directory; use a fresh template VM' >&2; exit 72; }
  mv "$cli_stage/cmdline-tools" "$ANDROID_HOME/cmdline-tools/22.0"
  printf 15859902 > "$ANDROID_HOME/cmdline-tools/22.0/.benchmark-version"
  rm -rf "$cli_stage"
fi
sdkmanager --install 'platforms;android-35'
# Install each new SDK package into a clean directory; no incomplete-directory overlay.
install_archive() {
  local url=$1 digest=$2 package=$3 probe=$4 archive stage
  archive=$(mktemp /tmp/android-sdk.XXXXXX.zip); stage=$(mktemp -d /tmp/android-sdk.XXXXXX)
  curl -fsSL "https://dl.google.com/android/repository/$url" -o "$archive"
  printf '%s  %s\n' "$digest" "$archive" | sha1sum -c -
  unzip -q "$archive" -d "$stage"
  test -s "$stage/android-37.0/$probe"
  rm -rf "$ANDROID_HOME/$package"
  mkdir -p "$ANDROID_HOME/$(dirname "$package")"
  mv "$stage/android-37.0" "$ANDROID_HOME/$package"
  rm -rf "$archive" "$stage"
}
install_archive platform-37.0_r02.zip ed8ebf7f8822a4de5686d427f237d2fa30ff7410 platforms/android-37.0 android.jar
install_archive build-tools_r37_linux.zip 70954e99f4c3d9d46ee70fa32624672fe7cd6ebe build-tools/37.0.0 aapt2
sudo npm install -g --prefix /opt/corepack corepack@0.36.0
sudo ln -sf /opt/corepack/bin/corepack /usr/local/bin/corepack
for manager in pnpm@10.12.3 pnpm@11.23.0 yarn@4.9.1; do
  manager_name=${manager%@*}; manager_version=${manager#*@}
  if ! corepack "$manager" --version 2>/dev/null | grep -Fx "$manager_version" >/dev/null; then
    rm -rf "$COREPACK_HOME/v1/$manager_name/$manager_version"
    corepack install --global "$manager"
  fi
  corepack "$manager" --version | grep -Fx "$manager_version"
done
mkdir -p /opt/android-toolchain
corepack pack pnpm@10.12.3 pnpm@11.23.0 yarn@4.9.1 --output /opt/android-toolchain/package-managers.tgz
tar -tzf /opt/android-toolchain/package-managers.tgz >/dev/null
rm -rf "$COREPACK_HOME"
for platform in android-35 android-36 android-37.0; do test -s "$ANDROID_HOME/platforms/$platform/android.jar"; done
for version in 35.0.0 36.0.0 37.0.0; do "$ANDROID_HOME/build-tools/$version/aapt2" version; done
printf '%s\n' 'v4: v3 public tools and dependency caches plus Android platforms 35/37.0, build-tools 37.0.0, Corepack 0.36.0 executable; fresh mutable manager cache per VM, Bun 1.4.2. No app source or credentials.' > /opt/android-toolchain/v4.txt
