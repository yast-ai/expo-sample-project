#!/usr/bin/env bash
# Run only after all project builds have ended and before `boat snapshot ... android-build-tools-v2`.
set -Eeuo pipefail
src_gradle=${1:?pass the public completed VM public Gradle cache root}
dst=/home/user/.gradle
sudo rm -rf "$dst"
sudo mkdir -p "$dst/caches/modules-2" "$dst/wrapper/dists"
# Maven artifacts and wrapper distributions are public dependency downloads. No transforms, build cache, daemon, task output, ccache, signing, or APK data survives.
for p in caches/modules-2/files-2.1 caches/modules-2/metadata-2.* wrapper/dists; do
  for source in "$src_gradle"/$p; do [ -e "$source" ] && sudo cp -a "$source" "$dst/${p%/*}/"; done
done
sudo rm -rf /tmp/repo /tmp/home /tmp/docker-lane /tmp/bench-cache /home/user/benchmark /home/user/build.log /home/user/.expo /home/user/.eas /home/user/.npmrc /home/user/.config/expo
sudo find "$dst" -type f \( -name '*.apk' -o -name '*.aab' \) -print0 | xargs -0 -r sudo rm -f
sudo find "$dst" -type f \( -name '*.lock' -o -name 'gc.properties' \) -delete
sudo find /home/user -maxdepth 3 -type f \( -name '.npmrc' -o -name 'credentials.json' -o -name 'auth.json' \) -delete
sudo find /tmp /home/user -maxdepth 3 -type d \( -name node_modules -o -name ccache \) -prune -exec rm -rf {} +
sudo docker ps -aq | xargs -r sudo docker rm -f
sudo rm -f /root/.docker/config.json /home/user/.docker/config.json /home/user/.netrc /home/user/.git-credentials /home/user/.bash_history
sudo chown -R user:user "$dst"
# The caller may supply known values through these environment variables. This reports only a count, never a value or filename.
for name in EXPO_TOKEN R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY BOAT_API_KEY; do
  value=${!name-}; [ -z "$value" ] && continue
  matches=$(grep -rlF -- "$value" /home/user /tmp /opt 2>/dev/null || true)
  [ -z "$matches" ] || { printf 'secret-match-count=%s\n' "$(printf '%s\n' "$matches" | sed '/^$/d' | wc -l | tr -d ' ')"; exit 1; }
done
sudo tee "$dst/README" >/dev/null <<'EOF'
Prewarmed public-only Maven modules-2 metadata/artifacts and Gradle wrapper distributions at /home/user/.gradle.
Project source, Expo/EAS credentials, signing files, APK/AAB outputs, transforms, build caches, daemon state, and ccache objects were removed before snapshotting.
EOF
