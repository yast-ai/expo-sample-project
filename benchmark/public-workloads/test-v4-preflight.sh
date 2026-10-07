#!/usr/bin/env bash
set -Eeuo pipefail
root="$(cd "$(dirname "$0")" && pwd)"
temp="$(mktemp -d)"
trap 'rm -rf "$temp"' EXIT
mkdir -p "$temp/bin" "$temp/sdk/cmdline-tools/22.0/bin" "$temp/toolchain"
printf '#!/usr/bin/env bash\necho v24.19.0\n' > "$temp/bin/node"
printf '#!/usr/bin/env bash\necho 1.4.2\n' > "$temp/bin/bun"
printf '#!/usr/bin/env bash\necho 22.0\n' > "$temp/sdk/cmdline-tools/22.0/bin/sdkmanager"
cat > "$temp/bin/corepack" <<'MOCK'
#!/usr/bin/env bash
set -e
case "$1" in
 install) test "$2" = --global; test "$3" = --cache-only; test -f "$4";;
 pnpm@11.23.0) echo 11.23.0;;
 pnpm@10.12.3) echo 10.12.3;;
 yarn@4.9.1) echo 4.9.1;;
 *) exit 72;;
esac
MOCK
chmod +x "$temp/bin/"* "$temp/sdk/cmdline-tools/22.0/bin/sdkmanager"
for api in 35 36 37; do
 mkdir -p "$temp/sdk/platforms/android-$api" "$temp/sdk/build-tools/$api.0.0"
 : > "$temp/sdk/platforms/android-$api/android.jar"
 printf '#!/usr/bin/env bash\ntest "$1" = version\n' > "$temp/sdk/build-tools/$api.0.0/aapt2"
 chmod +x "$temp/sdk/build-tools/$api.0.0/aapt2"
done
: > "$temp/toolchain/package-managers.tgz"
sed "s#/home/user/android-sdk#$temp/sdk#g;s#/opt/android-toolchain#$temp/toolchain#g;s#/tmp/v4-corepack#$temp/cache#g;/^export PATH=/d" "$root/v4-preflight.sh" > "$temp/preflight.sh"
PATH="$temp/bin:$PATH" bash "$temp/preflight.sh" >/dev/null
rm "$temp/toolchain/package-managers.tgz"
if PATH="$temp/bin:$PATH" bash "$temp/preflight.sh" >/dev/null 2>&1; then echo 'Missing manager archive was accepted' >&2; exit 1; fi
: > "$temp/toolchain/package-managers.tgz"
rm "$temp/sdk/build-tools/37.0.0/aapt2"
if PATH="$temp/bin:$PATH" bash "$temp/preflight.sh" >/dev/null 2>&1; then echo 'Missing SDK37 binary was accepted' >&2; exit 1; fi
echo 'v4 preflight validates tool executions and rejects missing archive or SDK binary'
