# Expo Android build sample

This backend lives in the `yast-ai` Convex project `expo-sample-builds`. It has no frontend and intentionally exposes one unauthenticated action.

```sh
bun install
bunx convex dev --once
bunx convex run android:runBuild
```

`runBuild` takes no arguments and returns a build ID immediately. The scheduler creates a large Boat sandbox, runs the 11-line setup script, and polls `/home/user/build.log` every 15 seconds. The script clones this public repository, installs dependencies with Bun, and runs the repository's local EAS CLI with `--local --platform android --profile preview`.

The sandbox receives `EXPO_TOKEN` from the Convex deployment. `BOAT_API_KEY` remains in Convex. Neither credential is committed. Set both in your own Convex deployment before calling the action.

The `builds` table stores `log`, `status`, and `finishedAt`. Status is `starting` during VM/toolchain setup, `in progress` after EAS launches, and then `success` or `error`. As requested, `finishedAt` is the outcome string `success` or `failure`, rather than a timestamp. `sandboxId` identifies the VM and `apkId` identifies the saved Convex artifact.

```sh
bunx convex run builds:get '{"id":"BUILD_ID"}'
bun run test
bun run typecheck
```

Each log line includes a UTC timestamp. The final line ends in `SUCCESS` or `ERROR`. On success, the backend saves the APK in Convex storage and returns its URL through the internal `builds:get` helper. Both terminal paths stop the sandbox, with scheduled cleanup retries. A failed build requires another `runBuild` call after the script or repository has been corrected.

The VM has a one-hour auto-stop and the scheduler ends an unfinished build after 55 minutes. Logs retain the most recent 180,000 characters to stay within Convex's document limit. The full build log is available inside the VM while it runs.

## Reusable Boat template

`android-build-tools` is a named Boat snapshot with Bun 1.4.2, Node 24, JDK 17, Android API 36, build-tools 36.0.0, NDK 27.1.12297006, and CMake 3.30.5. It contains no project checkout or Expo credentials. The generic installer is [`../scripts/install-android-tools.sh`](../scripts/install-android-tools.sh).

The backend creates each VM with `from: "android-build-tools"`. Its 11-line per-build script only exports tool paths, clones the repository, installs dependencies, and runs EAS. Other projects can use the same template with their own setup script.

Boat caps artifact downloads at 50 MiB. The backend downloads the APK in 40 MiB pieces and assembles it into a single APK before storing it in Convex.
