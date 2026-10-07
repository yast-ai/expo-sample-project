#!/usr/bin/env bash
# Tools-only v4 snapshot upgrade. Capture as a new snapshot after restore checks.
set -Eeuo pipefail
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ANDROID_HOME=/home/user/android-sdk ANDROID_SDK_ROOT=/home/user/android-sdk
export PATH="$ANDROID_HOME/cmdline-tools/22.0/bin:$ANDROID_HOME/platform-tools:$PATH"
sdkmanager --install 'ndk;27.0.12077973' 'ndk;27.1.12297006' 'cmake;3.22.1' 'cmake;3.30.5'
sudo npm install -g --prefix /opt/eas22 eas-cli@22.0.0
/opt/eas22/bin/eas --version
test -s "$ANDROID_HOME/ndk/27.0.12077973/source.properties"
"$ANDROID_HOME/ndk/27.0.12077973/toolchains/llvm/prebuilt/linux-x86_64/bin/clang" --version
mkdir -p /home/user/.gradle
printf 'org.gradle.workers.max=4\norg.gradle.parallel=true\norg.gradle.caching=true\norg.gradle.jvmargs=-Xmx6144m -XX:MaxMetaspaceSize=2048m\nkotlin.compiler.execution.strategy=in-process\n' > /home/user/.gradle/gradle.properties
printf '%s\n' 'v5: v4 tools plus NDK27.0/27.1, CMake3.22/3.30, EAS22, Gradle4w/6GiB/in-process Kotlin; no app source or credentials.' > /opt/android-toolchain/v5.txt
