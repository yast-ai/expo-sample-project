# Fresh Android release-build options

## Scope and compatibility

This is a **fresh project-output** benchmark, not a network-cold benchmark: the
template deliberately carries public Android tooling and dependency caches. The
project source, EAS working directory, generated Android directory, native object
files, and local task/configuration-cache entries remain cold for each lane.

Keep the two toolchains independent. The public lane's stated AGP 8.12 line has
an official minimum Gradle requirement of 8.13; that table does not certify every
newer Gradle release. The private AGP 9.2 line officially specifies Gradle 9.4.1
and JDK 17. Test each pair as a complete toolchain; do not borrow a Gradle cache
between incompatible releases. Current public cold logs report Gradle 9.3.1, so a
9.4.1 switch is a distinct experiment, not a silent benchmark assumption.

- [AGP compatibility table](https://developer.android.com/build/releases/about-agp)
- [AGP 9.2 compatibility: Gradle 9.4.1 and JDK 17](https://developer.android.com/build/releases/agp-9-2-0-release-notes)

## What the seed legitimately removes

Gradle's dependency cache holds downloaded artifacts and resolution metadata.
Gradle documents copying `modules-*` caches into ephemeral containers and a
shared read-only cache for concurrent readers. Artifact transforms can also be
cacheable. Seeding those artifacts/transforms avoids download, resolution, and
some transform work; it does **not** make the application build warm.

The template must only seed caches built by a compatible Gradle version, omit
lock files when copying, and give every VM its own writable cache. Sharing a
normal writable dependency cache across isolated VMs is not the documented
container-safe model; the documented shared form is read-only.

- [Gradle dependency cache and ephemeral-build guidance](https://docs.gradle.org/current/userguide/dependency_caching.html)
- [Gradle artifact transforms](https://docs.gradle.org/current/userguide/artifact_transforms.html)
- [Gradle managed cache directories](https://docs.gradle.org/current/userguide/directory_layout.html)

## Work that remains cold

For a clean EAS working directory, release-specific Android code generation,
manifest/resource processing, D8/R8, signing/package creation, CMake configure,
and C/C++ compilation still execute. A local build cache or a configuration
cache cannot hit until a compatible earlier build has written an entry for the
same inputs. Configuration-cache reuse is therefore warm-only across equivalent
working trees; it is not an explanation for an intrinsically faster first build.

The current all-ABI private log also records failed Prefab hard links falling
back to copies from the Gradle transform cache into the EAS work tree. That is a
concrete cold-path I/O candidate, but changing filesystem layout or link policy
needs an isolated experiment. It is not evidence that more JVM heap helps.

- [Gradle build cache semantics](https://docs.gradle.org/current/userguide/build_cache.html)
- [Gradle configuration cache semantics and limits](https://docs.gradle.org/current/userguide/configuration_cache.html)

## Candidate experiments, in order

1. **Keep public artifacts/transforms seeded and project outputs cold.** Record
   seed manifest/version and label the result `SDK-seeded cold`; do not call it
   network-cold. This is the low-risk baseline for both targets: Native <=300 s,
   Private <=500 s.
2. **Use Android codegen PCH only where the SDK-pinned Expo plugin has already
   generated the verified JNI CMake/OnLoad integration.** It reduces repeated C++
   header parsing while retaining four ABIs and clean native outputs. Compare it
   to an otherwise identical control.
3. **Measure actual CMake/Ninja occupancy before changing `-j`.** Four ABIs and
   independent native targets can oversubscribe an 8-vCPU VM. Track observed
   Ninja command lines, CPU PSI, iowait, and per-task merged wall time. A fixed
   Ninja cap can reduce contention; it is not a cache.
4. **Trial configuration cache separately.** It is primarily warm-only. On a
   first miss it still configures and writes state, so it may add cost. Adopt
   only after a strict compatibility run; environment variables used during
   configuration are cache inputs.
5. **Keep Kotlin execution strategy a separate variable.** Kotlin documents the
   daemon as Gradle's default and fastest strategy; in-process shares the Gradle
   JVM and is simpler to bound. Choose with measured wall time and memory/OOM
   evidence, not by increasing heap. Current GC evidence alone is not a reason
   to raise heap.

- [Gradle performance guidance](https://docs.gradle.org/current/userguide/performance.html)
- [Kotlin compiler execution strategy](https://kotlinlang.org/docs/compiler-execution-strategy.html)

## Locks and concurrency

Gradle's normal dependency metadata cache uses file locks. Its documentation
permits concurrent access only when processes can communicate, which is commonly
not true for containers; the read-only shared cache exists for that case.
Gradle task parallelism helps only where the dependency graph permits it. A
single long native chain, CMake configure lock, Prefab copy, or release packaging
step remains a critical path even with six workers.

Do not infer that a higher heap or more workers improves fresh release builds.
The required evidence is the phase/task timeline plus CPU, PSI, iowait, OOM, and
observed Ninja concurrency for the same pinned source/toolchain.
