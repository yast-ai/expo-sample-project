# Expo Android build sample

This backend lives in the `yast-ai` Convex project `expo-sample-builds`. It has no frontend and intentionally exposes one unauthenticated action.

```sh
bun install
bunx convex dev --once
bunx convex run android:runBuild '{"gitRepo":"https://github.com/yast-ai/expo-sample-project.git","environment":"preview"}'
```

`runBuild` takes an HTTPS `gitRepo` and an `environment` EAS profile (`preview` or `production`), and returns a build ID immediately. Optional `projectDirectory` selects an app inside a monorepo. The scheduler creates a large Boat sandbox, runs the 11-line setup script, and polls `/home/user/build.log` every 15 seconds. The script clones the requested repository, installs dependencies with Bun, and runs its local EAS CLI. Preview produces an APK; production produces an AAB.

The sandbox receives `EXPO_TOKEN` from the Convex deployment. `BOAT_API_KEY` remains in Convex. Neither credential is committed. Set both in your own Convex deployment before calling the action. The dedicated Boat key needs `sandbox.create`, `sandbox.read`, `sandbox.stop`, `exec`, `file.read`, and `snapshot.read` so it can start from the template.

The `builds` table stores `log`, `status`, and `finishedAt`. Status is `starting` during VM/toolchain setup, `in progress` after EAS launches, and then `success` or `error`. As requested, `finishedAt` is the outcome string `success` or `failure`, rather than a timestamp. `sandboxId` identifies the VM and `apkId` identifies the saved Convex artifact.

```sh
bunx convex run builds:get '{"id":"BUILD_ID"}'
bun run test
bun run typecheck
```

Each log line includes a UTC timestamp. The final line ends in `SUCCESS` or `ERROR`. On success, the backend saves the artifact in Convex storage and returns `artifactUrl` through the internal `builds:get` helper. Both terminal paths stop the sandbox, with scheduled cleanup retries. A failed build requires another `runBuild` call after the script or repository has been corrected.

The VM has a one-hour auto-stop and the scheduler ends an unfinished build after 55 minutes. Logs retain the most recent 180,000 characters to stay within Convex's document limit. The full build log is available inside the VM while it runs.

## Reusable Boat template

`android-build-tools` is a named Boat snapshot with Bun 1.4.2, Node 24, JDK 17, Android API 36, build-tools 36.0.0, NDK 27.1.12297006, and CMake 3.30.5. It contains no project checkout or Expo credentials. The generic installer is [`../scripts/install-android-tools.sh`](../scripts/install-android-tools.sh).

The backend creates each VM with `from: "android-build-tools"`. Its 11-line per-build script only exports tool paths, clones the repository, installs dependencies, and runs EAS. Other projects can use the same template with their own setup script.

Boat caps artifact downloads at 50 MiB. The backend downloads the APK in 40 MiB pieces and assembles it into a single APK before storing it in Convex.

Restored Boat home directories use a lazy filesystem. The setup checks out the repo under `/tmp`, sets `BUN_INSTALL_CACHE_DIR=/tmp/bun-cache`, and uses Bun’s `--backend=copyfile` to avoid incomplete hardlinked packages. EAS runs through `node node_modules/eas-cli/bin/run`. The sample trusts only `esbuild` dependency lifecycle scripts; EAS CLI’s optional DTrace native module is unnecessary here.
