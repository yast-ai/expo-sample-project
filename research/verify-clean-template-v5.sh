#!/usr/bin/env bash
set -Eeuo pipefail
test -s /opt/android-toolchain/v5.txt
test -x /opt/eas22/bin/eas
for p in /home/user/.ssh /home/user/.expo /home/user/.eas /home/user/.git-credentials /home/user/.npmrc /root/.npmrc; do
  if sudo test -e "$p"; then echo "CREDENTIAL_PATH_PRESENT: $p"; exit 61; fi
done
# Keep only reusable public Maven artifacts and Gradle distributions.
find /home/user/.gradle -mindepth 1 -maxdepth 1 ! -name caches ! -name wrapper ! -name gradle.properties -exec rm -rf {} +
find /home/user/.gradle/caches -mindepth 1 -maxdepth 1 ! -name modules-2 -exec rm -rf {} +
find /home/user/.gradle/wrapper -mindepth 1 -maxdepth 1 ! -name dists -exec rm -rf {} +
suspect=$(find /home/user /tmp /opt -name node_modules -prune -o -name .git -print 2>/dev/null | sed '\|^/home/user/.nvm/.git$|d' || true)
test -z "$suspect" || { printf 'APP_SOURCE_PRESENT: %s\n' "$suspect"; exit 62; }
artifacts=$(find /home/user /tmp /opt -name node_modules -prune -o -type f \( -name '*.apk' -o -name '*.aab' -o -name google-services.json -o -name credentials.json \) -print 2>/dev/null || true)
test -z "$artifacts" || { printf 'APP_ARTIFACT_PRESENT: %s\n' "$artifacts"; exit 63; }
printf 'CLEAN_TEMPLATE\n'
