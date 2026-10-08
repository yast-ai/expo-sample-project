# Cold-build RAM headroom audit

## Scope and metric meaning

This review covers the completed one-second `metrics.ndjson`, `processes.ndjson`, and JVM GC logs from the benchmark set ending `1791418500000`.

`memoryUsed` is **not** a process-RSS measurement. The sampler defines it as `MemTotal - MemAvailable`; therefore it estimates memory that is not readily available to new allocations. It can include anonymous/process memory and unreclaimable or less-readily-reclaimable cache, but the retained data cannot decompose those categories. `memoryAvailable` is the relevant host headroom measure. `swapUsed` is sampled occupancy only: it does **not** record swap-in/swap-out rates, so a small nonzero value cannot prove that swapping was harmless or active.

The host has 15.62 GiB (`MemTotal`). Java RSS includes heap plus metaspace, code cache, direct/native allocations, and mapped files; it is not equal to `-Xmx`. A Gradle `-Xmx` change is a capacity change, not a promise that the JVM will consume that additional memory.

## Observed cold-run pressure

| Run | Gradle heap cap | Peak `MemTotal - MemAvailable` | Minimum `MemAvailable` | Peak swap | Peak simultaneous sampled process RSS | JVM / native RSS at that peak | Memory PSI p95 | OOM |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Native A-2 baseline | 4 GiB | 10.47 GiB | 5.14 GiB | 65.9 MiB | 9.87 GiB | 5.04 / 4.83 GiB | 0.32% | 0 |
| Native C-2 Ninja 4 | 4 GiB | 10.18 GiB | 5.44 GiB | 2.0 MiB | 8.47 GiB | 5.35 / 3.12 GiB | 0.38% | 0 |
| Disposabl D-1 PCH + Ninja 4 | 4 GiB | 11.33 GiB | 4.29 GiB | 103.9 MiB | 9.97 GiB | 5.17 / 4.81 GiB | 0.32% | 0 |
| Disposabl A-1 baseline | 4 GiB | 12.25 GiB | 3.36 GiB | 141.6 MiB | 11.40 GiB | 4.94 / 6.46 GiB | 0.62% | 0 |
| Disposabl B-2 PCH | 4 GiB | 14.40 GiB | 1.21 GiB | 232.7 MiB | not used for the bound | max separately 6.52 / 6.57 GiB | 0.76% | 0 |
| Disposabl C-2 Ninja 4 | 4 GiB | 14.60 GiB | 1.01 GiB | 245.9 MiB | not used for the bound | max separately 6.74 / 4.52 GiB | 0.52% | 0 |

The “under 11 GiB” observation holds for the completed native-heavy controls. It does **not** generalize to Disposabl: two completed cold runs left only about 1.0–1.2 GiB `MemAvailable` and had 233–246 MiB of nonzero swap occupancy.

CPU steal is low (p95 0.13–0.38% except native D-1 at 7.6%), mean I/O wait is low (0.32–0.80%; p95 1.25–3.81% in the rows above), and no run reported an OOM event. That makes CPU/native work more plausible bottlenecks than ordinary disk wait, but it does not make more JVM heap free.

## GC evidence

| Run family | Pause events | Sum of logged stop-the-world pauses | p95 pause | Longest pause |
| --- | ---: | ---: | ---: | ---: |
| Native A-2 | 314 | 7.96 s | 89 ms | 286 ms |
| Native C-2 | 277 | 7.03 s | 80 ms | 388 ms |
| Native D-1 | 278 | 9.97 s | 137 ms | 314 ms |
| Disposabl D-1 | 838 | 18.00 s | 57 ms | 681 ms |
| Disposabl A-1 | 816 | 20.55 s | 81 ms | 811 ms |
| Disposabl B-2 | 883 | 22.57 s | 81 ms | 939 ms |

These totals are not transferable wall-clock savings: some pauses occur off the critical path and concurrent GC work is not represented by stop-the-world duration. The active Disposabl R8 snapshot separately showed 2.89 GiB used of 4.00 GiB heap, 486 MiB metaspace, five runnable R8 workers, and 0.86 s of pauses over an 11.2-second observed R8 interval. That is evidence of GC cost, not evidence that R8 was at its heap limit.

## Heap-size bound

### 6 GiB

A 6 GiB Gradle heap increases the cap by 2 GiB. Across the completed native-heavy cold runs, the worst `MemAvailable` range is 4.85–5.63 GiB; A-baseline replicas specifically show 4.93–5.14 GiB. A **single-variable native-heavy 6 GiB A-baseline trial is viable**, provided it preserves six Gradle workers, the same four ABIs, existing minification/profile settings, PCH setting, Ninja setting, Gradle cache seed, and ccache policy. It is still not a 2 GiB guaranteed process increase: the observed daemon already had 5.0–5.35 GiB JVM RSS at peak despite `-Xmx4g`.

For Disposabl, the same 6 GiB trial is less safe: baseline replicas had only 3.36–3.55 GiB available; D-1 had 4.29 GiB; and two other completed variants reached 1.01–1.21 GiB. Run it only after the native-heavy result, with automatic stop on meaningful memory PSI growth, increased swap occupancy, or an OOM counter change.

### 8 GiB

An 8 GiB cap adds 4 GiB of potential heap capacity. This is not supported by the completed data. It would consume most of the 4.85–5.63 GiB native-heavy headroom if realized while clang/ninja are present, and is plainly unsafe as a general Disposabl cold-run setting given the 1.0–1.2 GiB minimum availability and nonzero swap occupancy in B-2/C-2. Do not use 8 GiB as the next experiment.

## Likely gain and next experiment

The only defensible expected effect of 6 GiB is reduced GC pressure. For native-heavy, 7–11.4 seconds of recorded stop-the-world time is a bound on **direct pause removal only**, about 1.6–2.3% of its 431–593 second cold wall time. It is not a bound on total heap-size benefit: concurrent GC CPU and allocation behavior can also change. The real gain can be zero or materially smaller because these pauses do not all block the critical path. There is no measurement that supports claiming a larger gain.

Run exactly one next cold experiment:

- **Project:** native-heavy
- **Variant:** A baseline only
- **Change:** `org.gradle.jvmargs=-Xmx6g` only
- **Keep fixed:** six workers, in-process Kotlin, Metro 4, all four ABIs, existing minification/profile settings unchanged, PCH disabled, Ninja default, ccache disabled, identical public Gradle modules/wrapper seed, clean EAS work root.
- **Record:** current one-second `MemAvailable`, swap occupancy, PSI, Java/native concurrent RSS, GC log, and task timeline.
- **Success criterion:** lower critical-path wall time with no OOM, no material rise in memory PSI/swap, and GC reduction large enough to explain the delta. Otherwise retain 4 GiB.

This isolates heap capacity from the native/PCH/Ninja strategies and establishes whether 6 GiB earns a place in later Disposabl trials.
