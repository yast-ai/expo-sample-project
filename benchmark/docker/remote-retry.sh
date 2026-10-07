#!/usr/bin/env bash
set -Eeuo pipefail
exec > >(TZ=UTC awk '{ print strftime("[%Y-%m-%dT%H:%M:%SZ]"), $0; fflush() }' >> /home/user/build.log) 2>&1
trap 'rc=$?; kill "${sampler:-}" 2>/dev/null || true; if [ "$rc" -eq 0 ]; then echo SUCCESS; else echo ERROR; fi' EXIT
rm -rf /tmp/docker-cache /tmp/repo/node_modules /home/user/benchmark/{cold,warm}.{apk,start,end,status} /home/user/benchmark/metrics.ndjson
mkdir -p /tmp/docker-cache/{gradle,bun,eas}
date +%s%3N > /home/user/benchmark/end-to-end.start
node /tmp/repo/benchmark/sample.mjs /home/user/benchmark/metrics.ndjson /home/user/benchmark/phase & sampler=$!
docker run --rm --cpus=8 --user 1000:1000 -e HOME=/tmp/home -e EXPO_TOKEN -v /tmp/repo:/workspace -v /tmp/docker-lane/runner.sh:/runner.sh:ro -v /home/user/android-sdk:/opt/android-sdk:ro -v /tmp/docker-cache/gradle:/cache/gradle -v /tmp/docker-cache/bun:/cache/bun -v /tmp/docker-cache/eas:/cache/eas -v /home/user/benchmark:/output expo-android-benchmark:node24 bash /runner.sh
date +%s%3N > /home/user/benchmark/upload.start
sha256sum /home/user/benchmark/cold.apk /home/user/benchmark/warm.apk > /home/user/benchmark/sha256.txt
date +%s%3N > /home/user/benchmark/upload.end
date +%s%3N > /home/user/benchmark/end-to-end.end
