#!/usr/bin/env bash
set -Eeuo pipefail
export PATH=/opt/corepack/bin:/opt/node-v24.19.0-linux-x64/bin:/usr/local/bin:$PATH
test "$(node --version)" = v24.19.0
test "$(bun --version)" = 1.4.2
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
test "$("/home/user/android-sdk/cmdline-tools/22.0/bin/sdkmanager" --version)" = 22.0
for api in 35 36 37.0; do test -f "/home/user/android-sdk/platforms/android-$api/android.jar"; done
for version in 35.0.0 36.0.0 37.0.0; do test -x "/home/user/android-sdk/build-tools/$version/aapt2"; "/home/user/android-sdk/build-tools/$version/aapt2" version >/dev/null; done
export COREPACK_HOME=/tmp/v4-corepack
corepack install --global --cache-only /opt/android-toolchain/package-managers.tgz
corepack pnpm@11.23.0 --version | grep -Fx 11.23.0
corepack pnpm@10.12.3 --version | grep -Fx 10.12.3
corepack yarn@4.9.1 --version | grep -Fx 4.9.1
