# Cold EAS Android review — 2026-10-08

Scope: review only; no implementation or VM actions. Targets are complete cold EAS local builds below 300 seconds (public native-heavy) and 500 seconds (private application), on 8 CPUs/16 GiB, with all four ABIs and unchanged release optimization, features and packaging. Retained project outputs, warm builds, ABI reduction and disabling R8 are outside scope.

## What the evidence establishes

| Observation | Consequence |
|---|---|
| Old public baseline EAS 392.986s; Gradle 370s. Latest V2 raw cold 418.835–530.110s. | The old result is a real reference, but different tool/source/cache recipes prevent assigning the regression to heap or workers. |
| S1 and S10 have identical cold configuration yet take 530.110 and 454.823s. | Single-run differences smaller than 75s cannot establish a configuration winner. Use replicas and phase evidence. |
| V2 cold GC pause totals 5.885–9.807s; no Full GC in reviewed raw lanes. | Bigger heaps have no demonstrated hundred-second opportunity. Pause totals exclude concurrent GC CPU; collect it before attributing CPU cost. |
| Private current EAS about1018s / Gradle979s. Earlier same-source historical Gradle670.86s used only ARM64, 4workers/6GiB, in-process Kotlin and another recipe. | The earlier measurement is neither all-four-ABI nor EAS duration. It does not prove a sub500s all-ABI cold build was previously achieved. |
| Private first app configure task290.801s; later ABI configure tasks roughly0.3–0.4s. Four sequential app native build tasks total209.8s. R8 isolated176.905s. | Configuration/setup, native compilation and R8 are distinct substantial regions. ABI count does not explain R8 cost. |
| S6 first app configure129.38s, later0.2–0.4s; sequential app builds total83.2s. S2 first configure120.69s and app builds129.9s. | “ConfigureCMake” wall time cannot be equated to compiler work. First-ABI attribution strongly warrants tracing shared setup/waits. |
| Private first app configure overlaps Skia builds142.8/77.5/55.9/55.8s plus other native/JVM tasks. | Do not add these durations to estimate removable critical-path time. Removing app configuration work may expose the overlapping branch. |

Evidence: `verification/benchmarks/native-heavy-preview-baseline-1791392846503/build.log`; V2 `tasks-cold.ndjson` and GC directories under `verification/benchmarks/v2-S*-1791414139468`; private `tasks-cold.ndjson` and `build-cold.log` under `verification/benchmarks/disposabl-private-v4-raw6-4g`. Historical comparison is documented in the separate backend repository's `docs/android-build-benchmark.md`. No private source or secrets are reproduced here.

Matched Docker/raw did not establish a useful cold advantage: EAS447.214/460.790s, but end-to-end536.503/525.838s respectively. Docker is not a priority experiment. A short resource-control sample found negligible steal time; that does not retrospectively explain earlier run variation. Historical CPU includes steal and should not be called pure guest compute utilization.

## Highest-value hypotheses

### 1. Enable the SDK-supported codegen PCH path, after verifying activation

Expo documents an opt-in codegen PCH implementation, with one large debug CMake task improving2.81x and a smaller project improving about1.3x. These are upstream examples, not predictions for our release builds. [Expo SDK56 announcement](https://expo.dev/changelog/sdk-56).

Both the official [SDK57 implementation](https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo-build-properties/src/android.ts) and [SDK58 implementation](https://raw.githubusercontent.com/expo/expo/sdk-58/packages/expo-build-properties/src/android.ts) accept `android.usePrecompiledHeaders` or `EXPO_USE_ANDROID_PRECOMPILED_HEADERS=1` inside the expo-build-properties plugin. The local native-heavy installed tree has Expo57.0.27 but no expo-build-properties package. An environment flag without the plugin running is therefore not sufficient evidence of activation. Pin the SDK-compatible package, register the plugin, and inspect generated release CMake/compile commands before spending a VM run.

The plugin writes app JNI CMakeLists.txt, OnLoad.cpp and PCH headers; SDK58 also generates an owner source. Existing custom JNI must be preserved. The SDK57 template adds PCH to eligible autolinked targets, rather than assuming that Reanimated's existing individual PCH covers all application codegen. [SDK57 template](https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo-build-properties/src/androidPCHTemplates.ts).

Opportunity: reduce repeated header parsing inside app native compilation. Applying the upstream1.3–2.81x range mechanically to observed app compilation gives roughly19–84s public and48–135s private task-time savings; this is a scenario calculation, not a forecast, and critical-path savings can be smaller. It does not justify claiming removal of120–291s configure time. PCH generation can itself cost time and RAM. Verify all ABI libraries and native initialization, not APK byte identity.

### 2. Resolve the first configure task's unexplained wall time before tuning it

This is the largest unexplained region. Later ABI configuration is tiny, while the first arm64 task lasts120–291s. Present telemetry records task boundaries, not CMake subprocess boundaries. Plausible sources include shared native-model generation, dependency/Prefab extraction or transforms, external process contention, compiler/IPO probes, and waits. None is established as the cause.

The checked local ReactNative-application.cmake calls `check_ipo_supported` and enables IPO on success. CMake documents this as a compile/link capability check; that establishes that a probe exists, not that it consumes80s. Do not force success or disable IPO: doing so can change build validity or release optimization. [CMake CheckIPOSupported](https://cmake.org/cmake/help/v4.0/module/CheckIPOSupported.html).

Next diagnostic builds must retain per-ABI CMake configure stdout/stderr and command timing, CMake try-compile logs, `.ninja_log`, and Gradle operation/profile information. Correlate subprocess launch/exit and parent PID with task intervals. If a long task has little CMake process CPU and waits behind other native tasks, address scheduling rather than compiler flags. If downloads/transforms dominate, first distinguish immutable dependency provisioning from project-generated outputs; the latter cannot enter the cold template.

Potential removable work is bounded above by the measured120–291s task region, but no credible point estimate exists yet. The overlapping Skia branch makes the full bound unrealistic as wall savings.

### 3. Test coordinated native scheduling, not another unstructured heap sweep

Gradle worker count is not a machine-wide compiler process limit. Multiple native tasks can each spawn Ninja workers. A Ninja `-j4` limit applies to each invocation, not the entire VM; `CMAKE_BUILD_PARALLEL_LEVEL` governs `cmake --build` and is not proof that AGP's direct Ninja invocation is capped. [CMake documentation](https://cmake.org/cmake/help/latest/envvar/CMAKE_BUILD_PARALLEL_LEVEL.html).

Use a verified Ninja wrapper and retain actual commands. Compare the same6worker/4GiB baseline with Ninja-j4. Existing S7 is not a causal win: its458.962s cold lies within the identical-configuration spread. A repeat can settle whether reduced compiler competition shortens the first configuration region and native critical path. If CPU pressure is high with many runnable compiler processes and weak throughput, fewer simultaneous compilations may help; if guest CPU is idle without IO/locks, a cap can hurt. There is no defensible numeric savings forecast yet.

Keep Kotlin in-process across the matrix to eliminate separate compiler JVM proliferation as a confound. It changes resource sharing, not automatically compiler throughput. All-CPU usage is useful only if completed work per second improves.

### 4. Optimize the private R8 tail only with phase-specific evidence

R8 accounts for176.9s of the current private cold run and occurs without overlapping recorded tasks. It is a real target, but it also took181.25s historically: it does not explain most of the private regression. Preserve minification, shrinking and all rules. Larger heap is justified only by R8 allocation/GC evidence; V2 public GC cannot diagnose private R8.

Android officially supports R8 execution profiles with a separate JVM and specified JVM options. That provides a controlled test if Gradle/Kotlin residency constrains R8, but another JVM can increase peak memory. Use the pinned AGP's supported settings plugin/profile interface, not undocumented R8 thread properties. [Android R8 execution profiles](https://developer.android.com/build/r8-execution-profiles). Android also recommends evaluating Parallel GC; our measured pause totals make this secondary, not a route to a guaranteed50% build improvement. [Android build optimization guidance](https://developer.android.com/build/optimize-your-build).

## Minimal staged matrix, at most20VMs

Do not spend all20 upfront. First use16 fresh cold builds: four recipes × two apps × two replicas. Interleave/randomize recipe placement within two launch blocks. Every run uses identical8CPU/16GiB resources, source/dependency locks, EAS22, tools template, all4ABIs, release settings, Kotlin in-process, Metro4, Node2GiB, and identical empty project/Gradle task/compiler cache conditions. Tools and downloaded dependency seed policy must be explicit and identical.

| Recipe | Only experimental difference |
|---|---|
| A | 6workers/4GiB baseline, default native parallelism |
| B | A + verified SDK-compatible codegen PCH |
| C | A + verified Ninja-j4 |
| D | A + PCH + Ninja-j4 |

This2×2 design isolates PCH, native scheduling and their interaction. It is more informative than four different worker/heap recipes, given current GC evidence. Installing the build-properties dependency should be standardized in all four recipes; only PCH activation differs. Keep ccache consistently disabled or empty/enabled in every lane; choose one policy before launch and do not import project compilation results. The first A/B pair should collect the configure subprocess diagnostics before the rest are released, so an inert PCH flag or broken instrumentation does not waste16 runs.

Reserve four slots for the winning recipe versus one evidence-driven change, two replicas each, on the app with the largest remaining bottleneck. Options:6GiB heap/ParallelGC only if measured GC CPU or allocation pressure supports it; R8 profile only for a constrained private tail; a source-verified setup fix only after exact wait/probe cause is known. Do not spend reserve slots on8GiB heap merely to fill RAM.

Capture EAS wall and full pipeline wall separately; task epochs, native subprocess CPU/time,1s guest CPU excluding steal, steal/iowait, memory/swap/PSI, all JVM RSS/main classes, GC pauses and concurrent CPU, OOM counters, actual compiler commands and cold cache stats. No Full GC does not imply zero GC overhead. Sum only non-overlapping critical-path intervals.

Success means repeated end-to-end cold EAS improvement with unchanged capabilities, no OOM, no hidden project-output prewarming, and verified APK ABIs/release settings/native behavior. Until measurements demonstrate otherwise, neither target is promised. Even the optimistic app-PCH scenario alone cannot bridge the private1018→500s gap; a major setup/scheduling improvement plus additional work would be required.

## Additional comparability and daemon checks

A historical SDK/package-version mismatch can explain a changed native graph, compiler/AGP behavior and additional codegen, but the present evidence does not quantify that contribution. A matching application commit alone does not establish identical resolved packages: compare the archived lockfile hash, actual Expo/RN/AGP/Kotlin/NDK/CMake versions and dependency graph. Do not label the historical build SDK48/SDK58, or assign its difference to an SDK upgrade, without those records. Public SDK57 and private SDK58 are separate workloads. The private R8 task's near-identical historical/current duration argues against R8 being the primary regression.

For a truly fresh cold build, enabling a reusable Gradle daemon cannot reuse compilation/JIT state from a prior build. Gradle may launch a single-use daemon even with `--no-daemon` when JVM arguments require it. Keep daemon policy constant; first inspect startup time and JVM launches before allocating a daemon experiment. In-process Kotlin avoids extra daemon memory but shares the Gradle heap, so private peak RAM must be measured again under the standardized recipe. ParallelGC must replace the existing collector consistently, not be added alongside incompatible collector flags. [Gradle daemon documentation](https://docs.gradle.org/current/userguide/gradle_daemon.html) and [Kotlin compilation documentation](https://kotlinlang.org/docs/gradle-compilation-and-caches.html).

## Follow-up: GC reconciliation and AGP implementation

Recomputed completed GC pause lines with a strict `[gc] GC(id) Pause ... duration-ms` match, excluding `[gc,start]`, deduplicating filename/PID + timestamp + GC id + pause kind, and filtering to `buildStartedAt .. buildStartedAt + durationSeconds`. S2 cold has318 completed pauses totaling8.279333s. Its lines containing Concurrent sum18.661478s; adding them gives26.940811s, explaining the reported roughly27s figure. That sum is not stop-the-world pause time: concurrent regions can overlap application execution and contain nested phase timings. The corrected raw cold pause totals are S1:8.677s, S2:8.279s, S3:7.145s, S4:5.885s, S5:9.807s, S6:8.025s, S7:8.396s, S9:9.110s, S10:8.998s. The retained private artifact directory has no GC logs; private GC cannot presently be quantified.

The local React Native Gradle plugin catalog pins AGP8.12.0. Downloaded and inspected the [official8.12.0 source archive](https://dl.google.com/dl/android/maven2/com/android/tools/build/gradle/8.12.0/gradle-8.12.0-sources.jar). This is the source matching that catalog, but the resolved runtime AGP version must still be printed by fresh instrumentation to rule out overrides.

`ExternalNativeBuildJsonTask` owns one `CxxAbiModel` and invokes one metadata generator. For our CMake versions the generator is `CmakeQueryMetadataGenerator`, extending `ExternalNativeJsonGenerator`; `configure()` calls `configureOneAbi()`. Consequently there is no support here for claiming that the arm64 task directly configures every ABI. Before entering `configureOneAbi`'s timing environment, it resolves the variant's prefab package configuration, package directory and classpath FileCollections. This creates a concrete location where lazy resolution/transforms/waits could be charged to the first task and excluded from the internal metadata-generation timing. It is a hypothesis until operation/process evidence identifies the wait.

AGP's `CxxCreateGradleTasks` adds dependencies on prefab package configurations and preBuild. `NativeLocationsBuildService` also synchronizes and caches CMake/Ninja discovery across tasks, including possible SDK installation on a missing tool. A template with every required CMake installed should avoid downloads, but logs must confirm. The generator separately times `generate-prefab-packages` and `execute-generate-process`: collect these existing metadata timing files alongside task epochs. Compare task elapsed against the generator's elapsed and actual CMake/Prefab process CPU to locate the gap.

The inspected local Reanimated Gradle script explicitly depends on Worklets' `externalNativeBuildRelease` from its own equivalent aggregate task. `--parallel` does not remove dependency edges. This alone does not prove that all per-ABI Reanimated compile tasks wait for the full Worklets aggregate, nor that the app configure task contains their work; inspect resolved task edges and timestamps. Shared Gradle/Prefab resolution may still wait while unrelated project work progresses. Do not “fix” this by deleting dependency edges: they protect required native artifacts. Local node_modules are a mutable analysis tree; the exact archived build dependency versions and generated task graph remain authoritative.

## Fresh cold round: first completed critical-path evidence

Native A2 completed EAS430.866s. Relative to its first recorded Gradle task, app arm64 configuration ran157–277s, while Reanimated's native/Prefab chain finished285s; app's four native build tasks then ran285–373s. Native C2 with Ninja-j4 configured the first ABI in159–162s, but Reanimated/Prefab finished289s; app builds ran289–405s. Thus the roughly116s reduction in the configure task label removed essentially no critical-path wait, while app compilation increased88.7→115.7s. The first configure task's wall duration is not an independently removable budget. Evidence: cold-native-heavy-A-2-1791418500000 and cold-native-heavy-C-2-1791418500000 task logs.

SDK-only Gradle task caching is a defensible separate cache class under the explicitly allowed generic dependency template policy. Label it **project-cold / SDK-seeded**. Generate the seed in a clean public harness; never filter a private Gradle home into a generic snapshot by taskPath alone. Names such as `:compileKotlin` collide across included builds. Admission requires public package source hash, included-build identity, task type and input provenance; Gradle's full task key must still match on restore. Only approved public SDK build-plugin compileKotlin/compileJava/resource/jar outputs belong in this class. Exclude application or native-module outputs, codegen, native compilation, R8, Metro, application Kotlin DSL/configuration caches, credentials and private-source-derived artifacts.

Concrete next test, if separately budgeted: build two immutable public seeds matching SDK57 and SDK58's exact Gradle/JDK/npm package locks, then two fresh-source EAS probes (one each) using recipeA and the seed. Preserve downloaded external dependency transforms plus the allowlisted SDK-plugin task-cache entries. Verify restored hits only on approved plugin tasks and that every app/native/codegen/R8 compilation remains cold. A manifest records tool/package/artifact hashes and seed provenance. Expand into each VM's private writable Gradle home after shutting down seed writers; do not share mutable cache locks. Gradle documents the distinction between artifact transforms and task outputs, but manual selective cache copying remains a tested implementation responsibility: [cache layout](https://docs.gradle.org/current/userguide/directory_layout.html), [artifact transforms](https://docs.gradle.org/current/userguide/artifact_transforms.html).

Bounds matter: the observed included-plugin task window is21.52s public /38.56s private, although summed Kotlin task durations are35.75s/59.74s due to overlap. Eliminating that task window cannot save150–200s. First native configure begins124.34s into public EAS and222.06s into private EAS; those totals also include EAS overhead and other configuration. Third-party transforms may reduce an additional portion, currently unquantified. The private thread dump was captured after native execution started and therefore cannot identify the earlier configuration lull. It shows native-process waits plus active Kotlin compilation; accumulated JIT CPU is separate from GC and cannot be equated to elapsed delay. The SDK-seed experiment is worthwhile, but it does not establish a path to either numerical target by itself.
