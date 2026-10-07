# Local Android cache plan

Verified 2026-10-08 against Expo documentation.

| Expo cloud feature | Boat local EAS equivalent | Scope |
| --- | --- | --- |
| Maven Central, Google Maven and Gradle Plugin proxy | Bake downloaded dependency artifacts into the toolchain template; persistent Gradle modules-2 and wrapper distributions | Dependency artifacts only, no signing/source |
| npm cache service | Persistent Bun/npm/pnpm/Yarn download stores, tool versions pinned in template | Immutable package tarballs |
| EAS_GRADLE_CACHE=1 | Explicit org.gradle.caching=true and persistent Gradle build-cache | Project/toolchain/lockfile scoped |
| EAS_USE_CACHE=1 / ccache | Install ccache in template; verify actual C/CXX launcher and hit/miss statistics | Project/native config scoped |

Local EAS does not support cloud cache orchestration. Setting cloud flags alone cannot restore caches in our Boat VM. The template therefore supplies real filesystem caches and compiler configuration. The template must contain no tokens, signing files, app source, APKs, project build outputs or private project task caches.

Keep base toolchain and reusable dependency cache separate from per-project task/compiler caches. Persisting modules-2 in a generic image improves first-request network time. Saving task/compiler results should use toolchain version, dependency lock hash, native config fingerprint, application scope and ABI configuration. Warm results rebuild source in an empty EAS directory with caches kept outside that directory. A freshly provisioned VM restored from a prewarmed template is labelled prewarmed, not dependency-empty cold.

Measure provisioning + cache hydration + checkout + install + EAS + upload + publication. Compare the same source, SDK, signing, ABI list and minification policy. Record FROM-CACHE task counts, ccache hits/misses, cache sizes and restore duration. Dependency downloads already cached do not remove CMake compilation.

Sources: [Expo cache documentation](https://docs.expo.dev/build-reference/caching/), [Gradle cache announcement](https://expo.dev/changelog/gradle-cache), [Local EAS limitations](https://docs.expo.dev/build-reference/local-builds/).
