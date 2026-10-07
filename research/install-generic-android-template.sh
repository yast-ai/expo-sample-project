#!/usr/bin/env bash
# Generic snapshot input: tools only. Run before any project checkout or Expo login.
set -Eeuo pipefail
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -qq
sudo apt-get install -y -qq openjdk-17-jdk-headless unzip curl ccache
command -v docker >/dev/null 2>&1 || sudo apt-get install -y -qq docker.io
node_version=24.19.0
case "$(uname -m)" in x86_64) node_arch=x64;; aarch64) node_arch=arm64;; *) exit 2;; esac
curl -fsSLO "https://nodejs.org/dist/v$node_version/node-v$node_version-linux-$node_arch.tar.xz"
curl -fsSLO "https://nodejs.org/dist/v$node_version/SHASUMS256.txt"
grep " node-v$node_version-linux-$node_arch.tar.xz$" SHASUMS256.txt | shasum -a 256 -c -
sudo rm -rf "/opt/node-v$node_version-linux-$node_arch"; sudo tar -C /opt -xf "node-v$node_version-linux-$node_arch.tar.xz"
sudo ln -sf "/opt/node-v$node_version-linux-$node_arch/bin/node" /usr/local/bin/node; sudo ln -sf "/opt/node-v$node_version-linux-$node_arch/bin/npm" /usr/local/bin/npm; sudo ln -sf "/opt/node-v$node_version-linux-$node_arch/bin/npx" /usr/local/bin/npx
node --version | grep -Fx "v$node_version"
curl -fsSL https://bun.sh/install | bash -s -- bun-v1.4.2
sudo ln -sf /home/user/.bun/bin/bun /usr/local/bin/bun
/home/user/.bun/bin/bun --version | grep -Fx 1.4.2
bun --version | grep -Fx 1.4.2
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=/home/user/android-sdk
export ANDROID_SDK_ROOT=/home/user/android-sdk
export PATH="/home/user/.bun/bin:$ANDROID_HOME/cmdline-tools/22.0/bin:$ANDROID_HOME/platform-tools:$PATH"
sudo npm install -g --prefix /opt/pnpm10 pnpm@10.12.3
sudo npm install -g --prefix /opt/pnpm11 pnpm@11.23.0 yarn@1.22.22
sudo ln -sf /opt/pnpm11/bin/pnpm /usr/local/bin/pnpm; sudo ln -sf /opt/pnpm11/bin/yarn /usr/local/bin/yarn
sudo npm install -g --prefix /opt/corepack corepack@0.36.0
sudo ln -sf /opt/corepack/bin/corepack /usr/local/bin/corepack
export COREPACK_HOME=/tmp/template-corepack-preflight COREPACK_ENABLE_DOWNLOAD_PROMPT=0
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
sudo tee /usr/local/bin/pnpm10 >/dev/null <<'EOF'
#!/bin/sh
exec /opt/pnpm10/bin/pnpm "$@"
EOF
sudo chmod +x /usr/local/bin/pnpm10
# Java CLI 22.0 is pinned; SDK37 is installed independently from verified archives.
if [ "$(cat "$ANDROID_HOME/cmdline-tools/22.0/.benchmark-version" 2>/dev/null || true)" != 15859902 ]; then
  cli_stage=$(mktemp -d /tmp/android-cli.XXXXXX)
  curl -fsSL https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip -o "$cli_stage/tools.zip"
  printf '040d3996a65543d22ec4bf73e4c37aa37a8d4af4  %s\n' "$cli_stage/tools.zip" | sha1sum -c -
  unzip -q "$cli_stage/tools.zip" -d "$cli_stage"
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  test ! -e "$ANDROID_HOME/cmdline-tools/22.0" || { echo 'CLI22 directory already exists; use clean installer input' >&2; exit 72; }
  mv "$cli_stage/cmdline-tools" "$ANDROID_HOME/cmdline-tools/22.0"
  printf 15859902 > "$ANDROID_HOME/cmdline-tools/22.0/.benchmark-version"
  rm -rf "$cli_stage"
fi

set +o pipefail; yes | sdkmanager --licenses >/dev/null; set -o pipefail
sdkmanager --install 'platform-tools' 'platforms;android-35' 'platforms;android-36' 'build-tools;35.0.0' 'build-tools;36.0.0' 'ndk;27.1.12297006' 'cmake;3.22.1' 'cmake;3.30.5'
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
for v in 35.0.0 36.0.0 37.0.0; do chmod -R a+rX "$ANDROID_HOME/build-tools/$v"; head -c 4 "$ANDROID_HOME/build-tools/$v/aapt2" >/dev/null || true; for n in $(seq 1 20); do "$ANDROID_HOME/build-tools/$v/aapt2" version >/dev/null 2>&1 && break; sleep 1; done; "$ANDROID_HOME/build-tools/$v/aapt2" version; done
sudo mkdir -p /home/user/.gradle/{caches/modules-2,wrapper/dists} /opt/android-toolchain/{docker,ccache}; sudo chmod -R a+rwx /opt/android-toolchain /home/user/.gradle
cat >/opt/android-toolchain/docker/Dockerfile <<'EOF'
FROM node:24.19.0-bookworm
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends openjdk-17-jdk ccache curl git && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://bun.sh/install | bash -s -- bun-v1.4.2 && install -m0755 /root/.bun/bin/bun /usr/local/bin/bun
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
EOF
sudo docker build -t android-toolchain:node24-bun1.4.2 /opt/android-toolchain/docker
printf '%s\n' 'Generic tool template. Public Gradle modules-2/wrapper cache lives at /home/user/.gradle for build scripts; provenance remains here. Prewarm only an allowlisted public dependency manifest; never snapshot project tasks, APKs, credentials, EAS dirs, Expo auth, or populated ccache.' | sudo tee /opt/android-toolchain/README >/dev/null
