# Build tuning from measured evidence

The target is minimum request-to-delivered-APK wall time with no crashes, swap growth or sustained memory pressure. CPU/RAM occupancy is diagnostic; filling RAM is not itself a success criterion.

## Measured recipes

| Workload / recipe | Cold EAS | Warm EAS | Cold / warm Gradle | Interpretation |
|---|---:|---:|---:|---|
| Native SDK57, raw 6 workers / 4GiB | 392.986s | 235.989s | 370s / 223s | Best earlier raw cold recipe |
| Native SDK57, raw 8 workers / 4GiB | 460.808s | 256.288s | 436s / 241s | More worker slots lost this observed pair |
| Native SDK57, raw 6 workers / 6GiB | 510.837s | 264.257s; 242.512s repeat | 475s / 249s; 227s repeat | Warm peak 14.50GiB; larger heap is not established as beneficial |
| Native SDK57, raw 4 workers / 6GiB + verified compiler cache | 489.649s | 134.912s | 461s / 122s | Warm has 448 direct compiler hits; worker/heap/cache changes are confounded |
| Disposabl historical ARM64, raw 4 workers / 6GiB + compiler cache | Unrecorded | Unrecorded | 670.86s / 87.29s | Reproduce this successful recipe; 302 warm direct hits |
| Disposabl current four-ABI, raw 6 workers / 4GiB | 1018s | 758s | 979s / 702s | Different architecture/path/compiler-cache setup; R8 executes warm for 144.278s |

Public Docker 6/4 shared-cache cold/warm/repeat was 442.387/255.899/239.838s. Its compiler-cache experiment's 168.128s warm did not repeat (254.058s). Docker currently has no repeatable speed advantage over raw execution.

## Controlled next comparison

Compare Disposabl 6 workers / 4GiB against 4 workers / 6GiB with the same source commit, ARM64, EAS22, template, in-process Kotlin, Metro4/Node2GiB, fresh fixed EAS path and persistent isolated Gradle/compiler caches. Both use unchanged release minification. This identifies a recipe winner, not which of the two changed settings caused it.

Capture per-phase machine/process resources, memory PSI, GC pauses and post-GC occupancy, exact Gradle task/cache status, generated Ninja compiler launchers and verbose ccache reasons. Keep full EAS, Gradle and delivered-artifact timings separate. Template public dependency prewarming is explicitly distinguished from project task/compiler cache reuse.

| Observation | Next single-variable change |
|---|---|
| Material GC in 6/4, with memory headroom | 6/6; retain workers and all cache settings |
| Material GC remains in 4/6, and native/Node spikes leave room | 4/8; only after checking aggregate process memory |
| Ready tasks wait for worker slots, with spare CPU and memory | Raise workers while retaining heap |
| Long CMake configuration/native work and little GC | Inspect native configuration, PCH and compiler-cache misses; retain JVM settings |
| Warm R8 executes while Java/Kotlin hit cache | Check R8 inputs/cache keys before increasing its resources |
| JS/Hermes dominates warm | Test persistent Metro transform/file-map cache and eager-bundle removal separately |

The public native app's JS/Hermes task remains 18.326s cold / 17.674s warm. Native warm configuration tasks around 78s overlap; they are not additive wall times. The historical private warm app JS/Hermes task is 53.187s, so Metro is worth targeting after native/R8 cache correctness is restored.

Gradle worker slots, CMake/Ninja jobs and Metro worker pools are independent concurrency controls. Gradle heap is a JVM ceiling, not the VM's entire memory budget. R8 can use its own execution profile and separate JVM heap; measure the project's actual mode before assuming Gradle heap governs it. See [Gradle performance](https://docs.gradle.org/current/userguide/performance.html), [R8 execution profiles](https://developer.android.com/build/r8-execution-profiles) and [Metro configuration](https://metrobundler.dev/docs/configuration/).

Evidence: benchmark job receipts and retained task/compiler logs; recovered `agent-sandbox-backend/docs/android-build-benchmark.md` and its benchmark script. No setting is yet proven optimal for every workload, and a cached R8 task cannot establish its executed-heap performance.
