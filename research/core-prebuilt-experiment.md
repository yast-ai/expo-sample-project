# Expo core58.0.8 public prebuilt experiment specification

Specification only,2026-10-08. No package, project or runner edits; no builds or VMs were performed for this specification. It describes a new public dependency artifact, not permission to overwrite a project's sources or bypass Expo's validation.

## Exact supported entry point

The integrity-verified [official expo-modules-core58.0.8 npm package](https://registry.npmjs.org/expo-modules-core/-/expo-modules-core-58.0.8.tgz), `android/build.gradle`, registers `cachePrebuiltNativeLibs`. This is a Gradle project task, not an Expo CLI command. It requires a valid Android/Expo Gradle host with the module included; the npm directory by itself is not a standalone Gradle application.

In a clean public SDK58 fixture whose Gradle project is actually named `:expo-modules-core`, the supported invocation from its generated Android directory is:

```sh
./gradlew :expo-modules-core:cachePrebuiltNativeLibs \
  -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64 \
  --no-daemon
```

Verify the project/task name using Gradle's project/task listing before execution. Do not infer the task path if autolinking names differ. Keep the fixture's wrapper, AGP, Kotlin, NDK, CMake and Java versions pinned to the intended consumer. Do not run an app assemble task to populate this seed.

The task explicitly detects its own name and disables use of existing prebuilts for that run. It depends on both `mergeDebugNativeLibs` and `mergeReleaseNativeLibs`, stages two library names (`libexpo-modules-core.so`, `libexpo-modules-jsi.so`), strips them with the selected NDK's llvm-strip, and creates:

- `node_modules/expo-modules-core/android/prebuilt/native-libs.tar.xz`
- `node_modules/expo-modules-core/android/prebuilt/metadata.json`

It deletes/replaces that public fixture's prebuilt directory during execution. Nothing in this procedure should operate on the user's installed package. Retain unstripped seed-build binaries separately if symbol verification is required; the distributed artifact follows the package task's stripping policy.

## Public-only fixture and seed boundary

Use a new minimal public Expo58 fixture, never the private application or a copied private Gradle home. Pin core58.0.8, RN0.88.0-rc.2, and public dependencies to the exact target set; record public package integrity hashes and Maven artifact checksums. Include the compatible Worklets version when validating the same integration, because the module wires Worklets' merge tasks into its native tasks when that project exists. These transitive builds remain seed-generation work; export only the two intended core/JSI libraries and their generated metadata.

The package separately resolves `io.github.expo:expo-modules-v2-react:0.2.0:cpp@zip`. Include that archive and all native header/library dependencies in provenance. The local package source MD5 alone does not identify those external inputs.

Keep the fixture's application tasks, generated app/codegen output, APKs, Metro, signing, credentials and all private files out of the seed. Export an immutable bundle and an independent provenance manifest. This experiment's result must be described as **first application build using a source-validated public core binary**, not a fully from-source dependency build.

## Guards and compatibility keys

The package accepts prebuilts only when the metadata/archive exist, the metadata React Native version equals its resolved version string, the native source hash matches, the cache-generation task is not running, and `expo.core.buildFromSource` is not true. Preserve those guards. Our audit shows the published58.0.8 archive fails its own source-hash check; rebuilding actual public sources allows the existing task to generate truthful metadata rather than manually changing the expected hash.

The built-in guard is necessary but narrower than full compatibility. The independent seed key must include:

- Exact npm source/integrity: core, expo-modules-jsi, RN, Worklets where integrated, and public patches if any.
- Exact resolved RN artifact/header version including RC identity, plus the normalized RN version string stored by Expo. Do not assume metadata's `0.88.0` alone distinguishes RC builds.
- External C++ source archive and Maven dependency checksums, including modules-v2.
- NDK/Clang, CMake, Ninja, Gradle, AGP, Kotlin and JDK versions; build-host architecture and OS.
- Four-ABI set, minSDK/API target used by the native toolchain, debug/release variants, STL, linker and compile flags, native feature defines, page-size support and other source-affecting options.
- Hashes of the native CMake files and build scripts, exact source MD5, generated archive SHA256 and each staged ELF's SHA256.

The package currently supplies `ANDROID_STL=c++_shared`, flexible-page-size support, RN target minor version, Hermes/test flags, modules-v2 source path, and optional Worklets path to CMake. Record effective compile/link commands; preserve flags rather than inferring them from the desired profile. No undocumented feature/thread changes belong in this experiment.

## Acceptance checks before a template can contain the artifact

1. Record that the official cache task succeeds from public sources with the four requested ABIs. Capture generated metadata and audit it using `research/audit-expo-prebuilt.mjs`; its source hash must match without any edits to the guard or sources.
2. Inspect archive paths safely. Require exactly both library names × four ABI directories × both variants:16 ELF files. Reject traversal paths, symlinks, extra unintended binaries, zero-length files and missing combinations.
3. Verify ELF machine/architecture, loadable shared-object type, SONAME/needed-library relationships, target API/toolchain properties where observable, and page alignment with the pinned NDK tools. Confirm debug and release metadata correspond to their actual native build settings. Metadata saying `stripped: true` is insufficient; llvm-strip must have existed and the build must have used it successfully.
4. Compare dynamic symbols/needed libraries against source-built fixture outputs; retain release optimization and linking behavior. A differing binary hash caused by stripping or build paths is not automatically a behavioral mismatch, but must be accounted for.
5. In a separate clean public consumer with the exact same dependency fingerprints, apply only the generated artifact pair through a deliberate dependency overlay. Preserve any unrelated JS patch. Verify the ordinary prebuilt guard accepts it, the archive is decompressed, and the two libraries are imported/packaged. Core Worklets glue or other separate native libraries may still compile normally.
6. Verify a changed included native source causes fallback; changing a JS-only file must not change the native source hash. A wrong RN version must reject the artifact. The existing audit fixture covers source selection; actual Gradle guard behavior still needs verification in the consumer experiment.
7. Verify all four ABIs are packaged. Perform runtime smoke tests for module initialization and required native capabilities on available real/emulated targets; a compile result alone does not validate ABI/link compatibility.

Important task weakness: the implementation accumulates a union of staged ABI names and only fails if that union is empty. Missing individual libraries or missing variant/ABI combinations can therefore escape its success condition. The16-file matrix check is mandatory. It also permits caching unstripped libraries when llvm-strip is absent, with a warning; reject that outcome for this matched-policy seed.

## Separate cold application comparison

After artifact validation and explicit authorization, compare identical fresh8CPU/16GiB EAS local app builds with the same public dependencies, four ABIs, R8, signing format, source and cache policy. Control uses the original published package's source fallback. Treatment supplies only the generated, source-matching core prebuilt pair. Both start with empty app/native/codegen/R8/Metro outputs; do not import the seed fixture's Gradle task cache or other outputs. Use replicas or interleaved ordering to account for prior host variation.

Capture complete EAS wall, full pipeline wall, native task epochs, per-task native commands, core prebuilt guard result, GC/CPU/steal/memory, archive/library fingerprints and final ABI inventory. The seed's own build time/storage must be reported separately. This tests the first application build benefit of removing core C++ compilation while preserving source identity; it does not test universal dependency precompilation or a warmer app cache.

Expectations must remain bounded: the private completed lanes were gated by Skia until543s/460s relative to first Gradle task. Removing only core work may free CPU but leave that gate intact. App C++99–128s, JS/update processing and R8134–136s remain. No result yet supports a private500s prediction. If this repair removes core compile tasks but does not improve EAS wall, that is a valid negative result and evidence to prioritize the other dependency branches.

## Failure modes and stop conditions

- Existing prebuilt hash is merely rewritten: invalid experiment; source provenance is not repaired.
- Public source or RN/JSI ABI differs from the consumer: rebuild the matching seed or allow normal source fallback.
- Private app configuration leaks into seed outputs: discard the seed; regenerate from the public fixture.
- Guard accepts an incomplete artifact: reject using the complete matrix/ELF validation above.
- Worklets integration, external modules-v2 inputs or compilation flags differ: compatibility key mismatch, no reuse.
- Kotlin/Java or app tasks become cached accidentally: the measured benefit is confounded; reset and repeat under the declared boundary.
- Partial archive or unsafe member names: reject before overlay. Install seed artifacts atomically into an isolated dependency copy.
- Build succeeds but native initialization fails: reject; do not report the optimization as complete.
