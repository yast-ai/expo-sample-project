# Public Expo workload benchmarks

This directory launches five pinned, public Expo/React Native workloads as separate Boat lanes. It preserves each upstream SDK and dependency lockfile, applies a local `yast-ai` EAS preview identity overlay, and measures a cold and warm signed Android APK build with artifact-upload receipts.

The workloads and source SHAs are recorded in `projects.json`: Bluesky Social (Expo 57), Expo Forge (Expo 57), Expo's PDF example (Expo 57), React Native Paper's example (Expo 56), and Obytes (Expo 54). The cloned upstream source trees are deliberately not part of this directory.

Before launching, an authorized operator must provide `BOAT_API_KEY` and a dedicated `EXPO_TOKEN` through the launcher environment and approve the selected large VMs. The launcher transfers the Expo token only as a per-VM environment value and never writes it to logs or source files. It currently expects the `android-build-tools-v3` Boat template, which provides the Android SDK and CMake 3.22.1.

Run the two shell harnesses plus `node test-public-eas-sampler.mjs` and `node test-public-eas-monitor.mjs` before a launch. They validate installer working directories, seeded home-cache locations, Gradle cache/parallel/worker/heap properties, per-phase task telemetry injection, Linux sampler records, and monitor terminal cleanup. `launch-public-eas-v2.mjs` is the only provisioning entrypoint; after creating public-lane job records it polls every 15 seconds, stores logs and NDJSON before stopping every terminal sandbox, and verifies uploaded APK receipts against the artifact store.

Retry changes: Forge uses Bun1.4.2 with a fresh cache after observed1.3.10 lifecycle failures; pnpm workloads use a fresh store with copy imports. Corepack homes are perVM; v4 supplies a portable manager archive. These preserve dependency pins. Use BENCHMARK_WORKLOAD_IDS to select an approved subset; monitor ownership is scoped to that launch. Publication retries and stop404 handling preserve verified results.
