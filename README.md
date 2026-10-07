# Expo SDK 57 Android build lab

[Live benchmark report](https://expo-boat-build-lab.vercel.app) · [Public source](https://github.com/yast-ai/expo-sample-project)

Four independent Expo/EAS projects share this repository:

| Directory | App | Preview | Production |
| --- | --- | --- | --- |
| `.` | One screen, Hello | signed release APK | AAB |
| `variants/js-heavy` | 100 imported JavaScript screens | APK | AAB |
| `variants/native-heavy` | Skia, Reanimated, camera, SQLite and native APIs | APK | AAB |
| `variants/convex-app` | Public notes, counter and cloud persistence | APK | AAB |

```sh
bun install --frozen-lockfile
bun start
bun run build:preview:android
```

All apps pin SDK 57 and include local Expo/EAS CLI dependencies. Local builds require JDK 17 and Android tooling; Boat's reusable `android-build-tools-v3` snapshot supplies them. The generic template contains verified SDK 35/36, CMake 3.22.1/3.30.5, Node/Bun/JDK, Docker and public Maven/package downloads. App code, signing credentials, task caches and populated compiler caches are excluded. Credentials are environment variables, excluded from Git.

## Convex build action

The separate yast-ai cloud project `expo-sample-builds` exposes one unauthenticated action. Supply the repository and EAS profile; `projectDirectory` is optional.

```sh
cd backend
bun install --frozen-lockfile
bunx convex run android:runBuild '{"gitRepo":"https://github.com/yast-ai/expo-sample-project.git","environment":"preview"}'
```

It returns a build ID immediately. Scheduled functions provision an 8-vCPU Boat sandbox, clone/install/build, upload directly to bucket-scoped Cloudflare R2 through the official Convex component, poll every 15 seconds, and stop the sandbox on either terminal outcome. The per-build setup script is 18 lines. `finishedAt` contains `success` or `failure`; `completedAt` is a timestamp. Timing fields measure request-to-downloadable-artifact, setup, native build and upload. [Backend details](backend/README.md).

The sample accepts HTTPS repositories in the yast-ai organization. Set `EXPO_TOKEN` and a dedicated `BOAT_API_KEY` on the Convex deployment. This is an intentionally public sample action.

## Measurements

The report also tracks five pinned public apps (Bluesky, Expo Forge, Expo PDF, React Native Paper and Obytes) at their upstream SDK versions. Disposabl is benchmarked privately; its source and artifacts are excluded from this repository and public report.

The report separates EAS build duration from trigger-to-artifact wall time. One-second VM samples measure CPU normalized across all 8 vCPUs, RAM used (total minus available), swap, disk growth and OOM counters. Warm runs reuse Bun/npm/Gradle caches in the same VM, while EAS generates a fresh native working directory. They are cache-warm builds, not a reused incremental native workspace.

End-to-end instrumentation was added during the benchmark; earlier runs show a dash where it was not recorded. New measurements include dispatch/provisioning/setup, EAS execution, polling and artifact upload. EAS cloud timings include its queue. APK behavior was checked on an Android API 37.1 arm64 emulator, including Convex mutations, live queries and persistence after relaunch.

Color-coded EAS phases show cold/warm wall times and saved seconds. Gradle task cache counts and complete task profiles identify compilation work that disappears or persists; parallel task durations overlap and are not summed into wall time. Warm repeat 1 and repeat 2 remain visible individually.

The live report retains the Vercel URL through a project-level rewrite to the existing Convex/R2 backend. `benchmark/live-report.mjs` updates only the three sanitized public report assets; it does not redeploy on every refresh.

The HTML report source is in `report/`; `benchmark/` contains the VM build/sampler and orchestration tools. [Storage comparison](research/pricing/one-gb-artifact-storage.md) uses usage-based pricing for one provider-billed GB and excludes included allowances.
