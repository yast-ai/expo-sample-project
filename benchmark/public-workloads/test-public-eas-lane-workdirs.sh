#!/usr/bin/env bash
set -Eeuo pipefail

script="$(cd "$(dirname "$0")" && pwd)/public-eas-lane.sh"
bash -n "$script"

# The installer case is intentionally inspected as text: executing the lane would
# clone and build public projects. These assertions prevent the VM-home mistake
# that caused the first v2 public-lane attempt to fail before compilation.
grep -F '(cd "$project" && corepack_run pnpm@11.23.0 install --frozen-lockfile --store-dir /tmp/benchmark-pnpm-store --package-import-method copy)' "$script"
grep -F '(cd "$source" && "$forge_bun" install --backend=copyfile --frozen-lockfile)' "$script"
grep -F '(cd "$project" && npm install)' "$script"
grep -F '(cd "$source" && corepack_run yarn@4.9.1 install --immutable)' "$script"
grep -F '(cd "$project" && CI=1 corepack_run pnpm@10.12.3 install --frozen-lockfile --store-dir /tmp/benchmark-pnpm-store --package-import-method copy)' "$script"
grep -F 'GRADLE_USER_HOME="${BENCHMARK_GRADLE_USER_HOME:-/home/user/.gradle}"' "$script"
grep -F 'npm_config_cache="${BENCHMARK_NPM_CACHE:-/home/user/.npm}"' "$script"
grep -F 'BUN_INSTALL_CACHE_DIR="${BENCHMARK_BUN_CACHE:-/home/user/.bun/install/cache}"' "$script"
grep -F 'export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64' "$script"
grep -F 'org.gradle.workers.max=6' "$script"
grep -F 'org.gradle.caching=true' "$script"
grep -F 'org.gradle.parallel=true' "$script"
grep -F 'org.gradle.jvmargs=-Xmx4096m -Dfile.encoding=UTF-8' "$script"
grep -F 'public-task-telemetry.init.gradle' "$script"
grep -F 'export BUILD_TELEMETRY_FILE="$output/$cache-tasks.ndjson"' "$script"
printf 'public-eas-lane installer working-directory assertions passed\n'
