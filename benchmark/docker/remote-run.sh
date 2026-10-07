#!/usr/bin/env bash
set -Eeuo pipefail
exec > >(TZ=UTC awk '{ print strftime("[%Y-%m-%dT%H:%M:%SZ]"), $0; fflush() }' >> /home/user/build.log) 2>&1
trap 'rc=$?; kill "${sampler:-}" 2>/dev/null || true; if [ "$rc" -eq 0 ]; then echo SUCCESS; else echo ERROR; fi' EXIT
mkdir -p /home/user/benchmark /tmp/docker-cache/{gradle,bun,eas}
date +%s%3N > /home/user/benchmark/end-to-end.start
date +%s%3N > /home/user/benchmark/setup.start
git clone --depth 1 https://github.com/yast-ai/expo-sample-project.git /tmp/repo
git -C /tmp/repo fetch --depth 1 origin 2f725a330e2385da1bccaa6a631cfba37291ce8c
git -C /tmp/repo checkout --detach 2f725a330e2385da1bccaa6a631cfba37291ce8c
date +%s%3N > /home/user/benchmark/setup.end
node /tmp/repo/benchmark/sample.mjs /home/user/benchmark/metrics.ndjson /home/user/benchmark/phase & sampler=$!
echo image-prep > /home/user/benchmark/phase
date +%s%3N > /home/user/benchmark/image-prep.start
docker build -t expo-android-benchmark:node24 /tmp/docker-lane
date +%s%3N > /home/user/benchmark/image-prep.end
docker run --rm --cpus=8 -e EXPO_TOKEN -v /tmp/repo:/workspace -v /home/user/android-sdk:/opt/android-sdk:ro -v /tmp/docker-cache/gradle:/cache/gradle -v /tmp/docker-cache/bun:/cache/bun -v /tmp/docker-cache/eas:/cache/eas -v /home/user/benchmark:/output expo-android-benchmark:node24 bash /runner.sh
date +%s%3N > /home/user/benchmark/upload.start
sha256sum /home/user/benchmark/cold.apk /home/user/benchmark/warm.apk > /home/user/benchmark/sha256.txt
date +%s%3N > /home/user/benchmark/upload.end
date +%s%3N > /home/user/benchmark/end-to-end.end
