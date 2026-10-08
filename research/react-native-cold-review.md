# React Native / Expo first-build review — 2026-10-08

Read-only research. No runner changes, VM actions, dependency changes or guard bypasses. All recommendations preserve four Android ABIs, release optimization/R8 and application capabilities.

## Confirmed first-build issue: Expo58.0.8 rejects its own shipped native binaries

The private build locks Expo58.0.0-preview.8, React Native0.88.0-rc.2, expo-modules-core58.0.8, Reanimated4.7.0 and Worklets0.13.0. Public native-heavy uses Expo57.0.27, RN0.86.3, Reanimated4.5.1, Worklets0.10.1 and Skia2.6.2. These are different dependency graphs; generic seeds must remain version-specific.

Private cold logs explicitly reject expo-modules-core's shipped native binaries because the source hash differs. The local application has a Bun patch, but it changes only compiled JavaScript (`build/NativeModulesProxy.native.js`), outside the native hash inputs. Its source-build autolinking overrides are iOS-only. The benchmark preparation changes EAS/Metro/PCH configuration, not core native sources.

Downloaded the [official npm58.0.8 package](https://registry.npmjs.org/expo-modules-core/-/expo-modules-core-58.0.8.tgz) and verified its SHA512 against the locked integrity. Reimplemented the package's own algorithm: sorted package-relative filenames, filename bytes + NUL + file bytes + NUL, MD5. It includes android/CMakeLists.txt, android/cmake, android/src/jsi, android/src/main/cpp and common/cpp, excluding the specified test/worklet trees and hidden files.

| Verification | Result |
|---|---|
| Fresh npm archive integrity matches lock | Yes |
| Eligible source files |133 |
| Actual source hash, fresh archive |450051339229554d0b0ca1580f892c9b |
| Actual source hash, installed application dependency |450051339229554d0b0ca1580f892c9b |
| Shipped prebuilt metadata source hash |c852e8e2eba26473f3af1a4e907188f6 |
| Native files differing between installed dependency and npm archive |0 |

This is a published-package source/metadata inconsistency, independent of the app's JS patch. It does not establish whether the binary or the metadata is stale. Never fix it by changing the expected digest or bypassing validation. A source-faithful repair requires a publisher-corrected package whose binary provenance matches the shipped source, or rebuilding exactly these public sources with the supplied `cachePrebuiltNativeLibs` task and validating the resulting release/debug artifacts and four ABIs. No corrected published version has yet been validated in this review.

Expo's SDK58 announcement specifically introduces precompiled core native libraries for both variants and all four ABIs. Its blank-debug example improves80→39s on an M3 Pro; that is not a prediction for our release workload. The first-build benefit exists without any previous application build. [SDK58 announcement](https://expo.dev/changelog/sdk-58-beta).

## Which optimizations affect the first application build?

| Mechanism | Classification | Applicability and evidence |
|---|---|---|
| Publisher-supplied React Native/Hermes and compatible Expo native binaries | First-app-build, dependency-precompiled | Avoid compiling unchanged dependency source. Verify selected dependency artifacts and source compatibility. Core58.0.8 currently falls back as above. |
| Codegen PCH | Inherently faster source compilation | Already tested: public app CMake wall88.6→65.5s, but total EAS430.9→496.5s in the single PCH lane because other branches slowed. No demonstrated whole-build win. |
| Public Gradle dependency transforms and build-plugin compilation seed | First-app-build, SDK-seeded | Avoid immutable SDK/tool work; measured included-plugin windows21.5s public and38.6s private. Transform savings unmeasured. |
| Exact public native/JVM module seed | First-app-build, public-dependency-seeded | Highest measured branch opportunity, particularly Skia; use a clean public harness, exact source/tool/flag keys and exclusion of app inputs. |
| SDK58 experimental Rust Metro transformer | Inherently faster cold transform, conditional | Investigate only if its activation constraints fit the application's Babel configuration; not equivalent to halving the full Gradle bundle/Hermes task. |
| Gradle configuration cache, previous task outputs, ccache from the same app, fingerprint build reuse | Subsequent-build reuse | Useful elsewhere but cannot substantiate a fully fresh application's source-cold result. |
| Single-ABI builds or disabling optimization | Different artifact/settings | Excluded by this task. |

Expo's official precompiled-module guide describes default use where packages support it, automatic source fallback, and opting out for native-source or compilation-option changes. It does not say every third-party Android library is precompiled. Its discussion of automatic third-party Reanimated/Worklets downloads is specifically iOS XCFrameworks; do not apply that claim to Android. [Precompiled modules](https://docs.expo.dev/guides/prebuilt-expo-modules/).

Expo-hosted npm/Maven caches speed dependency acquisition; custom saved directories and ccache reuse previous compilation. These are separate from publisher-supplied binaries. Local EAS must explicitly implement its generic seed policy rather than assume hosted infrastructure is reproduced. [EAS caching](https://docs.expo.dev/build-reference/caching/), [local builds](https://docs.expo.dev/build-reference/local-builds/).

## React Native recommendations and their limits here

RN's current build-speed guide recommends development-only ABI restriction, configuration caching for subsequent builds, Maven mirrors and compiler caching. A mirror can improve first-build downloads; configuration-cache reuse cannot skip a first configuration. Keeping all four release ABIs is consistent with the guide. These recommendations do not provide a documented switch that removes several minutes of first-build application compilation. [RN build-speed guide](https://reactnative.dev/docs/build-speed).

The versioned RNGP implementations configure React/Hermes dependencies, native setup, codegen and autolinking. Library codegen is coupled to app/root settings; a public package name is not sufficient proof that every generated output is generic. Both schema/artifact codegen can skip work when the package declares shipped generated code, but setting that marker without actual publisher-generated compatible files would be incorrect. Preserve app codegen. [RN0.86.3 plugin source](https://raw.githubusercontent.com/facebook/react-native/v0.86.3/packages/gradle-plugin/react-native-gradle-plugin/src/main/kotlin/com/facebook/react/ReactPlugin.kt), [RN0.88.0-rc.2 plugin source](https://raw.githubusercontent.com/facebook/react-native/v0.88.0-rc.2/packages/gradle-plugin/react-native-gradle-plugin/src/main/kotlin/com/facebook/react/ReactPlugin.kt).

## CMake scheduling: what the fresh logs actually prove

Private PCH lanes B1/D1 finish858.555/850.353s. Their arm64 configure tasks take118.1/265.9s, while captured internal metadata generation takes1.395/1.052s and actual CMake execution0.631/0.509s. Optimizing compiler probes cannot remove the task's apparent minutes: most elapsed time lies outside that internal region.

B1 Skia's four native tasks run178–333,333–432,432–489,489–543s relative to first Gradle task. App native compilation starts544s, despite configuration finishing339s. D1 Skia ends460s and app compilation starts463s. Skia is a real dependency gate. Reanimated finishes377/348s, so speeding it alone exposes Skia. Gradle parallelism cannot bypass required artifacts; Ninja-j4 caps each subprocess, not aggregate machine concurrency.

A public-native/JVM seed must shorten competing branches together. It must exclude app C++, app codegen, R8, Metro, signing and app-generated resources. Do not subtract summed public compilation durations from EAS wall: many overlap. B1 app native work99.4s and R8135.9s remain; its JS task74s overlaps earlier dependency work. D1 app native127.9s is followed by42s JS and134s R8. Removal of native competition could accelerate remaining work, but the amount is unmeasured.

## Remaining genuinely cold experiments, ranked

1. Repair/validate the official core58.0.8 prebuilt mismatch without changing source behavior. This restores an intended first-build optimization. Its wall benefit is bounded by the competing branches, especially Skia.
2. Verify publisher-supported prebuilt artifacts for the exact public dependencies, then evaluate an explicitly labeled public-dependency seed where official binaries are unavailable. Match public source, transitive headers, compiler/toolchain, all ABI/variant flags and complete task inputs. Retain cold app compilation and R8.
3. Add immutable external dependency transforms and exact SDK build-plugin seeds, recording this separately from native dependency seeding. Measure rather than assigning the entire124–222s pre-native interval to caches.
4. Evaluate the SDK58 Rust transform worker only after checking Babel/custom-worker compatibility. Expo documents `experiments.noxcturnalTransformWorker`; it does not activate for unsupported custom configurations and falls back for Worklets/Reanimated transformations. The upstream2x example concerns cold bundling, not all JS/Hermes/Gradle work. [SDK58 transformer description](https://expo.dev/changelog/sdk-58-beta).
5. Collector/heap and coordinated scheduling experiments remain secondary. Existing public pause totals are roughly6–10s without Full GC. In the latest lanes, lower configure duration did not reliably advance the app dependency gate.

No evidence establishes native<300s or private<500s with the required artifact. The defensible next step is validating the concrete prebuilt rejection and measuring separately attributable first-app-build optimizations, not promising the target from an idealized sum of saved tasks.

Local evidence: `verification/benchmarks/cold-disposabl-B-1-1791418500000-retry1/build.log`, task logs and `archive/timing-archive`; corresponding D1 artifacts; native A2/B/C2 task and Ninja logs. Public package verification used `/tmp/astra-expo-modules-core-58.0.8.tgz`; no private source or credentials were uploaded.

## Reusable audit and follow-up releases

`node research/audit-expo-prebuilt.mjs <extracted-public-package> [installed-package]` reads the package's literal source-root/exclusion lists without executing its code, reproduces the source hash and emits JSON. Exit0 means matching metadata (and matching optional installed sources); exit1 means a mismatch; exit2 means unsupported input/error. It does not verify binary provenance: a matching digest is necessary, not sufficient. The fixture test verifies that JavaScript and excluded test-source changes do not affect the hash, while an included native edit does. `node --test research/audit-expo-prebuilt.test.mjs` passes.

Official npm tarballs58.0.9 and58.0.10 were downloaded, integrity-checked against their npm SHA512 metadata, and inspected without installation or upgrading the project. Neither repairs the guard mismatch:

| Version | Files | Actual source MD5 | Shipped expected MD5 | Result |
|---|---:|---|---|---|
|58.0.8 |133 |450051339229554d0b0ca1580f892c9b |c852e8e2eba26473f3af1a4e907188f6 |Mismatch |
|58.0.9 |133 |450051339229554d0b0ca1580f892c9b |c852e8e2eba26473f3af1a4e907188f6 |Mismatch |
|58.0.10 |133 |9e4c898436ebef7148afc2e6c538d2f2 |c852e8e2eba26473f3af1a4e907188f6 |Mismatch |

Sources: [npm58.0.9 package metadata](https://registry.npmjs.org/expo-modules-core/58.0.9), [npm58.0.10 package metadata](https://registry.npmjs.org/expo-modules-core/58.0.10). These two versions are checked candidates, not a claim about the latest available release. Do not upgrade to either solely expecting this first-build issue to disappear.
