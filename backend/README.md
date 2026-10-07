# Expo Android build sample

This backend lives in the `yast-ai` Convex project `expo-sample-builds`. It has no frontend and intentionally exposes one unauthenticated action.

```sh
bun install
bunx convex dev --once
bunx convex run android:runBuild '{"gitRepo":"https://github.com/yast-ai/expo-sample-project.git","environment":"preview"}'
```

`runBuild` takes an HTTPS `gitRepo` and an `environment` EAS profile (`preview` or `production`), and returns a build ID immediately. Optional `projectDirectory` selects an app inside a monorepo. The scheduler creates a large Boat sandbox, runs the 18-line setup script, and polls `/home/user/build.log` every 15 seconds. The script clones the requested repository, installs dependencies with Bun, and runs its local EAS CLI. Preview produces an APK; production produces an AAB.

The sandbox receives an ephemeral, bucket-scoped R2 PUT URL and `EXPO_TOKEN` from the Convex deployment. `BOAT_API_KEY` remains in Convex. Neither credential is committed. Set both in your own Convex deployment before calling the action. The dedicated Boat key needs `sandbox.create`, `sandbox.read`, `sandbox.stop`, `exec`, `file.read`, and `snapshot.read` so it can start from the template.

The `builds` table stores `log`, `status`, and `finishedAt`. Status is `starting` during VM/toolchain setup, `in progress` after EAS launches, and then `success` or `error`. As requested, `finishedAt` is the outcome string `success` or `failure`, rather than a timestamp. `sandboxId` identifies the VM and `storageKey` identifies the saved R2 object.

```sh
bunx convex run builds:get '{"id":"BUILD_ID"}'
bun run test
bun run typecheck
```

Each log line includes a UTC timestamp. The final line ends in `SUCCESS` or `ERROR`. On success, the backend saves the artifact in Cloudflare R2 and synchronizes metadata through the official Convex R2 component and returns `artifactUrl` through the internal `builds:get` helper. Both terminal paths stop the sandbox, with scheduled cleanup retries. A failed build requires another `runBuild` call after the script or repository has been corrected.

The VM has a one-hour auto-stop and the scheduler ends an unfinished build after 55 minutes. Logs retain the most recent 180,000 characters to stay within Convex's document limit. The full build log is available inside the VM while it runs.

## Reusable Boat template

`android-build-tools` is a named Boat snapshot with Bun 1.4.2, Node 24, JDK 17, Android API 36, build-tools 36.0.0, NDK 27.1.12297006, and CMake 3.30.5. It contains no project checkout or Expo credentials. The generic installer is [`../scripts/install-android-tools.sh`](../scripts/install-android-tools.sh).

The backend creates each VM with `from: "android-build-tools"`. Its 18-line per-build script only exports tool paths, clones the repository, installs dependencies, and runs EAS. Other projects can use the same template with their own setup script.

The VM PUTs the artifact directly to private Cloudflare R2 using a signed URL valid for one hour. Convex stores metadata and verifies object size before marking success. APK bytes never pass through the Boat 50 MiB download endpoint or the Node action memory limit. Uploads have a 115-second deadline and finish before the script writes SUCCESS. `/artifact?id=BUILD_ID` redirects to a fresh signed download URL, so downloads bypass Convex file-storage egress. Set `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` on this deployment; keep the Cloudflare key restricted to this bucket. See [R2 setup](convex/R2_ARTIFACTS.md).

`setupStartedAt`, `buildStartedAt`, `buildCompletedAt`, `uploadStartedAt`, `uploadCompletedAt` and `artifactReadyAt` record VM phase boundaries. `endToEndSeconds` is the time from the build row’s creation to scheduler confirmation of the stored artifact; `completedAt` records when the scheduler confirms success and `artifactBytes` is verified storage size. Provisioning/dispatch is creation→setupStartedAt; setup is setupStartedAt→buildStartedAt; build is buildStartedAt→buildCompletedAt; upload is uploadStartedAt→uploadCompletedAt; metadata confirmation/publish is uploadCompletedAt→artifactReadyAt. `artifactReadyAt` equals the completed row timestamp, when the stable download redirect is resolvable.

Restored Boat home directories use a lazy filesystem. The setup checks out the repo under `/tmp`, sets `BUN_INSTALL_CACHE_DIR=/tmp/bun-cache`, and uses Bun’s `--backend=copyfile` to avoid incomplete hardlinked packages. EAS runs through `node node_modules/eas-cli/bin/run`. The sample trusts only `esbuild` dependency lifecycle scripts; EAS CLI’s optional DTrace native module is unnecessary here.

Set `ANDROID_BUILD_TEMPLATE` to a verified named Boat template. The setup uses `/home/user/.gradle`, so public Maven artifacts and wrapper distributions baked into that location are available on the first request. Tooling and SDK installation belong in the reusable template. Per-app task/compiler caches remain isolated from generic templates.
