# Boat Android local-EAS findings

## Confirmed Boat contract

- Create: `POST /api/v1/sandboxes` (or `boat.create`) accepts `type` (`small`, `default`, `large`), `ttlSeconds`, `env`, `noEnv`, `environment`, and `setupScript`.  The API returns before setup completes; poll `GET /sandboxes/:id` until a usable state (`ready`/`idle`/`running`) and examine `setupStatus`/`setupError`.
- A setup script is the right primitive here: Boat runs it once in the background during provisioning. `noEnv: true` prevents account-wide credentials leaking in. Pass only `EXPO_TOKEN` as the per-sandbox `env` value from a Convex server environment. A public GitHub clone needs no GitHub token.
- Reading the incremental build log can use `GET /sandboxes/:id/files?path=build.log&encoding=utf8`; it resolves paths under `/home/user`. The raw command endpoint is `POST /sandboxes/:id/commands`, but has a 600-second cap; it is unsuitable for waiting on an Android build. A detached command supports `GET /commands/:processId`, but is unnecessary when the full build is the setup script.
- Stop after a terminal marker: `POST /sandboxes/:id/stop` archives a snapshot first. If storage is not needed, `DELETE /sandboxes/:id` permanently removes the sandbox and snapshots. An APK can be downloaded before stop with `GET /sandboxes/:id/artifact?path=app.apk` (or the SDK `artifact`).
- Before starting a sandbox, SDK `limits()` exposes `canStart`, `startBlockedReason`, active count, and creation/start limits. Do not treat an API key as valid for sandbox creation until that says `canStart: true`.

The installed `@boatdev/convex` component exposes the same useful surface: `create`, `refresh`, `readFile`, `stop`, `destroy`, and `spawn`/`commandStatus`. It does not need a direct `fetch` wrapper for this sample.

## Toolchain evidence and choice

The live no-env `large` preflight on 2026-10-07 found 8 vCPU, 15 GiB RAM (14 GiB available), and 122 GiB free disk. It already has Bun `1.3.14` and Node `24.18.1`; it has Java 11 only and no Android SDK. Therefore the setup must install JDK 17 and Android tooling, but does not need to install Bun or Node. The prior Boat setup in `/Users/vivekbezawada/Projects/agent-sandbox-backend/scripts/setup-boat-android.sh` installed all tools because it was deliberately pinned to Bun 1.4.2.

The actual generated project pins Expo `57.0.27` and React Native `0.86.3`. Its installed `react-native/gradle/libs.versions.toml` specifies API 36, build-tools `36.0.0`, and NDK `27.1.12297006`; `ReactAndroid/build.gradle.kts` sets CMake `3.30.5`. Install all four because the default new architecture compiles native C++ even for a blank app. The project already declares `eas-cli` `24.11.0`; `bunx --bun --no-install eas-cli` runs that local version without a global installation or package download.

## Proposed setup script (20 physical lines)

This assumes `eas-cli` is in the repository and an `eas.json` profile named `preview` builds an APK. The per-sandbox `EXPO_TOKEN` comes from Convex; the script never prints it. Every command output line gets an ISO timestamp and the final line is exactly `SUCCESS` or `ERROR`.

```bash
#!/usr/bin/env bash
set -Eeuo pipefail
log=/home/user/build.log; mkdir -p /home/user; : > "$log"
stamp(){ awk '{ print strftime("[%Y-%m-%dT%H:%M:%S%z]"), $0; fflush() }' >> "$log"; }
run(){ "$@" 2>&1 | stamp; return "${PIPESTATUS[0]}"; }
trap 'rc=$?; printf "[%s] %s\\n" "$(date -Iseconds)" "$([ "$rc" -eq 0 ] && echo SUCCESS || echo ERROR)" >> "$log"; exit "$rc"' EXIT
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ANDROID_HOME=/home/user/android-sdk ANDROID_SDK_ROOT=/home/user/android-sdk
run bash -c 'sudo apt-get update -qq && sudo apt-get install -y -qq openjdk-17-jdk-headless unzip'
mkdir -p "$ANDROID_HOME/cmdline-tools"
run curl -fsSLo /tmp/android.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
run bash -c 'unzip -q /tmp/android.zip -d "$ANDROID_HOME/cmdline-tools" && mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"'
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
yes | sdkmanager --licenses >/dev/null || test "${PIPESTATUS[1]}" = 0
run sdkmanager 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0' 'ndk;27.1.12297006' 'cmake;3.30.5'
run git clone --depth 1 https://github.com/yast-ai/expo-sample-project.git /home/user/app
cd /home/user/app; run bun install --frozen-lockfile
run bunx --bun --no-install eas-cli build --platform android --profile preview --local --non-interactive --output /home/user/app.apk
test -s /home/user/app.apk
```

## Build-state mapping for the Convex action

1. Insert a build row with `status: "starting"`, then create the Boat sandbox with the script and `env: { EXPO_TOKEN }`.
2. Schedule the first poll after 15 seconds. While Boat is provisioning or `build.log` does not end in a marker, retain `starting` (before `setupStatus === "running"`) or use `in progress` once setup begins.
3. Read `build.log` every 15 seconds. It is always safe to save a bounded tail to `log`, avoiding a growing Convex document.
4. A final `SUCCESS` means set `status: "success"`, `finishedAt` to the current timestamp, and stop the sandbox only after the APK is downloaded or intentionally discarded. A final `ERROR`, `setupError`, or terminal Boat error means `status: "error"`, save the tail, set `finishedAt`, and stop it.

## Likely failures and smallest correction

| Symptom | Smallest fix |
| --- | --- |
| `sdkmanager` rejects licenses or package is missing | Install cmdline tools as above and run `yes | sdkmanager --licenses` before packages. |
| EAS reports a missing Android SDK/JDK | Keep JDK 17, API 36 and build-tools 36.0.0 in the setup script; export both `ANDROID_HOME` and `ANDROID_SDK_ROOT`. |
| `bun: command not found` | The checked base image includes Bun 1.3.14. If a future image loses it, add the pinned Bun installer from the prior Boat setup before `bun install`. |
| `eas` is missing | Add `eas-cli` to devDependencies in the sample repo; keep the script's local binary path. |
| Build log ends without a marker | The trap did not run (VM-level interruption). Map terminal Boat `setupError`/failed state to `error`, stop the sandbox, then correct the setup script before retrying in a fresh sandbox. |
| 600-second command timeout | Do not launch the Android build through the synchronous command endpoint. Use the `setupScript` and file polling, or a detached command plus command-status polling. |

## Sources checked

- Official Boat SDK reference, local installed `@boatdev/sdk` README/type declarations, and local `@boatdev/convex` source.
- Prior verified Boat scripts: `/Users/vivekbezawada/Projects/agent-sandbox-backend/scripts/setup-boat-android.sh` and `convex/lib/androidSetup.ts`.
- Existing Android runner: `/Users/vivekbezawada/Projects/tinyapk-builds-964795/packages/build-runner/src/android-script.ts`.
- One live Boat no-env `large` preflight: completed successfully, read `/home/user/preflight.txt`, then immediately stopped (`archiving`).
