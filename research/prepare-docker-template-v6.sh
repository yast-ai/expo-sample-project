#!/usr/bin/env bash
# Tools only: host Android SDK is mounted at runtime; this image intentionally contains no SDK/NDK.
set -Eeuo pipefail
exec > >(TZ=UTC awk '{ print strftime("[%Y-%m-%dT%H:%M:%SZ]"), $0; fflush() }' >> /home/user/v6-docker-template.log) 2>&1
export DEBIAN_FRONTEND=noninteractive
sudo systemctl start docker 2>/dev/null || sudo service docker start 2>/dev/null || (sudo dockerd >/tmp/v6-dockerd.log 2>&1 &)
for _ in {1..60}; do sudo docker info >/dev/null 2>&1 && break; sleep 1; done
sudo docker info >/dev/null
work=/tmp/android-toolchain-v6
rm -rf "$work"; mkdir -p "$work"
cat > "$work/Dockerfile" <<'DOCKERFILE'
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 PATH=/opt/node/bin:/opt/bun/bin:$PATH
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl unzip zip git ccache openjdk-17-jdk-headless bash xz-utils && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://nodejs.org/dist/v24.19.0/node-v24.19.0-linux-x64.tar.xz | tar -xJ -C /opt && mv /opt/node-v24.19.0-linux-x64 /opt/node \
 && curl -fsSL https://github.com/oven-sh/bun/releases/download/bun-v1.4.2/bun-linux-x64.zip -o /tmp/bun.zip && unzip -q /tmp/bun.zip -d /opt && mv /opt/bun-linux-x64 /opt/bun && install -m 0755 /opt/bun/bun /usr/local/bin/bun && rm /tmp/bun.zip
RUN node --version | grep -qx 'v24.19.0' && bun --version | grep -qx '1.4.2' && java -version && ccache --version
DOCKERFILE
sudo docker build --pull --tag android-toolchain:node24-bun1.4.2 "$work"
sudo docker run --rm android-toolchain:node24-bun1.4.2 bash -c "set -euo pipefail; node --version | grep -qx 'v24.19.0'; bun --version | grep -qx '1.4.2'; java -version; ccache --version"
sudo mkdir -p /opt/android-toolchain
sudo docker save android-toolchain:node24-bun1.4.2 -o /opt/android-toolchain/android-image.tar
sudo tar -tf /opt/android-toolchain/android-image.tar >/dev/null
sudo sha256sum /opt/android-toolchain/android-image.tar | sudo tee /opt/android-toolchain/android-image.tar.sha256 >/dev/null
rm -rf "$work"
echo V6_DOCKER_READY
