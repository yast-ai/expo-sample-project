# Expo runner and cache audit

Checked official documentation on 2026-10-08. This concerns Android release builds using `eas build --local`, with all four ABIs. Download caches and compilation caches are different layers.

| Layer | Expo cloud | Boat template/current cold round |
|---|---|---|
| Tools | SDK 57 image lists Java 17, NDK 27.1.12297006, Node 22.23.1, Bun 1.3.14 and package managers | Java 17, that NDK, installed SDK/CMake versions, Node 24.19, Bun 1.4.2 and EAS 22 are preinstalled. Versions are pinned within this round, but the image is not an exact Expo replica. |
| Downloaded dependencies | Internal npm proxy and Maven proxy for Central, Google and Gradle plugins | Public Maven `modules-2` and Gradle wrapper distributions copied to a private writable Gradle home. Fresh app dependency installation remains. |
| C++ compilation | Optional persistent ccache restore/save | Earlier warm runs tested persistence. Current source-cold round disables it to avoid importing previous compilation outputs. |
| Custom caches | Configured paths restored after JS dependencies; saved after success | Must implement restore/save ourselves. Local EAS does not provide cloud caching. |
| Gradle resources | Medium 4 CPU/16 GB, heap 4 GB; large 8 CPU/32 GB, heap 8 GB. Parallel builds and daemon disabled. | 8 CPU/16 GB, six Gradle workers, 4 GB heap, parallel builds and single-use daemon policy. Do not copy the large heap blindly onto half the RAM. |

Sources: [runner infrastructure](https://docs.expo.dev/build-reference/infrastructure/), [dependency caching](https://docs.expo.dev/build-reference/caching/), [local-build limitations](https://docs.expo.dev/build-reference/local-builds/).

## What has actually improved

Tool installation moved into a reusable credential-free snapshot. Public Maven downloads and wrapper distributions are seeded. Experiments now measure the full EAS window separately from provisioning and artifact publication, confirm four ABI libraries in the APK, retain task intervals and native compiler logs, and capture GC, process memory, CPU pressure, steal and OOM counters.

These are setup and measurement improvements. They have **not** established a faster complete source-cold build. Fresh Native baseline replicas took 430.866 and 439.029 seconds; PCH took 496.506 seconds; Ninja-j4 replicas took 460.777 and 529.569 seconds. The combined treatment took 592.404 seconds. APKs retained all four ABIs. Sample sizes are small and host variation matters.

PCH activation was verified in generated app headers and Ninja rules. In one comparison it reduced app native task wall time from 88.6 to 65.5 seconds, while overlapping Reanimated and Skia work grew. A shorter task does not establish a shorter critical path. Similarly, Ninja-j4 shortened the first configure task label by about 116 seconds, but the app still waited for the Reanimated/Prefab dependency chain.

## Next cache classes to validate

1. **Project-cold / SDK-plugin-seeded.** A clean public SDK harness can prepare artifact transforms and public Gradle plugin compilation. Cache admission requires included-build identity, exact public source/toolchain/input provenance, and normal Gradle input-key validation. Task names alone are insufficient. Observed plugin task windows are about 21.5 seconds public and 38.6 seconds private; additional transform savings remain unmeasured.
2. **Project-cold / public-native-dependencies-seeded.** A separate clean public harness can populate a compiler cache for public dependency translation units across all four ABIs. Exclude app code, generated code and any private-source inputs. Validate exact compiler flags, public header provenance and invalidation across unrelated projects. Reanimated/Worklets PCH can limit reuse; do not silently enable ccache settings that relax validation.

Both classes must remain distinct from tools/Maven-only source-cold results. A broad native dependency seed has more potential than a single-library seed because native dependencies overlap. Neither has a measured savings claim yet. R8, Metro, app compilation and packaging remain real work. See the [ccache manual](https://ccache.dev/manual/latest.html) and the Astra review for the cache boundary and validation requirements.

## Private R8 snapshot

A read-only snapshot during the baseline run confirmed R8 9.2.14 executing in the Gradle JVM. Five of eight R8 ForkJoin workers were runnable. Java heap usage was 2.89 GiB of 4.00 GiB. In the matched 11.2-second snapshot window, 48 completed GC pauses totaled 0.863 seconds; the longest was 47.4 milliseconds. This is a short window, not the full R8 phase. It establishes active CPU work and some GC overhead, without a heap-exhaustion signal. It does not establish a larger heap as a route to hundreds of seconds of savings.

## CPU throughput and concurrent experiments

Eight visible guest CPUs do not establish eight exclusive physical cores. Boat lists its standard large VM size and Ryzen hosts, but does not publish placement, pinning or SMT guarantees. Its managed-service terms permit resource throttling and migration. AMD lists the 9950X as 16 cores / 32 threads with up to 5.7 GHz boost; that is a single-core burst capability, not a sustained all-core clock guarantee.

Most measured guest steal averages were below 0.12%; the combined Native treatment showed materially more steal. Low steal does not prove identical physical throughput or exclude SMT/cache/memory contention. No current evidence proves that our parallel VMs shared a host. A randomized, repeated single-VM versus concurrent-burst comparison would measure that effect; provider placement telemetry would be needed to attribute it to physical allocation.

Sources: [Boat capacity](https://boat.dev/compare), [Boat terms](https://boat.dev/terms), [AMD 9950X specifications](https://www.amd.com/en/products/processors/desktops/ryzen/9000-series/amd-ryzen-9-9950x.html), [AMD boost definition](https://www.amd.com/en/technologies/zen-core.html).
