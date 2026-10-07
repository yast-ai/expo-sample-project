export function setupScript(gitRepo: string, environment: "preview" | "production", projectDirectory = ".") {
  const url = new URL(gitRepo);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("Use an HTTPS Git repository URL without credentials");
  if (url.hostname !== "github.com" || !/^\/yast-ai\/[A-Za-z0-9_.-]+\/?$/.test(url.pathname)) throw new Error("This sample builds repositories in the yast-ai GitHub organization");
  if (!/^[\w./-]+$/.test(projectDirectory) || projectDirectory.startsWith("/") || projectDirectory.split("/").includes("..")) throw new Error("Use a relative project directory");
  const quote = (s: string) => "'" + s.replaceAll("'", "'\"'\"'") + "'";
  const extension = environment === "production" ? "aab" : "apk";
  return `#!/usr/bin/env bash
set -Eeuo pipefail
exec > >(TZ=UTC awk '{ print strftime("[%Y-%m-%dT%H:%M:%SZ]"), $0; fflush() }' >> /home/user/build.log) 2>&1
trap 'code=$?; if [ "$code" -eq 0 ]; then echo SUCCESS; else echo ERROR; fi' EXIT
export EXPO_TOKEN BUN_INSTALL_CACHE_DIR=/tmp/bun-cache JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ANDROID_HOME=/home/user/android-sdk ANDROID_SDK_ROOT=/home/user/android-sdk PATH="/home/user/.bun/bin:/home/user/android-sdk/cmdline-tools/latest/bin:/home/user/android-sdk/platform-tools:$PATH"
git clone --depth 1 ${quote(gitRepo)} /tmp/app
cd ${quote(`/tmp/app/${projectDirectory}`)}
bun install --frozen-lockfile --backend=copyfile
echo IN_PROGRESS
node node_modules/eas-cli/bin/run build --local --platform android --profile ${environment} --non-interactive --output /home/user/app.${extension}
test -s /home/user/app.${extension}
`;
}
