# Benchmark review

Raw Android EAS preview builds with six Gradle workers and a 4 GiB heap are the provisional default on 8 CPU / 16 GB VMs. Native baseline cold/warm times were 392.986/235.989 seconds, compared with 460.808/256.288 seconds at eight workers. These are observed comparisons, not a universal speed guarantee.

Docker now has successful signed preview APKs. At six workers and 4 GiB, a shared-cache mount recorded 442.387/255.899/239.838 seconds for cold/warm/warm2. The ccache lane recorded 456.943/168.128/254.058 seconds. The isolated 168-second improvement did not repeat. Verify generated compiler launchers and per-build ccache counter deltas before attributing a gain to ccache. Docker can also incur swap pressure, including roughly 2 GiB in one warm run. A stable OOM counter does not prove absence of memory pressure.

The six-worker 6 GiB heap lane recorded 510.837/264.257/242.512 seconds and reached 14.50 GiB used memory in its first warm run. It is not the demonstrated winner. Earlier 3/4 GiB lane failures happened in SDK or launcher setup and do not establish heap-performance differences. Two live private SDK 58 lanes compare 3 and 4 GiB without publishing source.

The reusable v3 template includes SDK 35/36, CMake 3.22.1 and 3.30.5, JDK 17, Node/Bun, Docker, and public dependency downloads. It excludes project code, credentials, signing material and populated task/compiler caches. Per-build scripts explicitly enable Gradle caching/parallelism with six workers and a 4 GiB heap.

The earlier Hello v2 restore test recorded 122/66 seconds with fresh EAS directories but retained public Maven/npm downloads. Gradle task output caching was disabled, and both runs had zero FROM-CACHE tasks. Label the first run template-prewarmed; this pair measures dependency/tool warming rather than Gradle task-cache reuse. A controlled follow-up should populate task caches and collect two warm repetitions on identical source and toolchain.

Full Gradle task durations overlap. Docker native warm2 had 772.79 seconds of summed task work within a 240.59-second Gradle build. Its app arm64 CMake configuration task occupied 109.39 seconds, making CMake logs and repeated setup a higher-value investigation than another unstructured worker sweep. Task start/end telemetry lets the report show both work totals and merged occupied wall intervals.

Artifacts upload directly from the VM to Cloudflare R2 through the official Convex component. The stable download endpoint redirects to a signed R2 URL. Request-to-artifact timing includes metadata publication; artifacts uploaded retrospectively are excluded from end-to-end comparisons. The public sample action intentionally has no auth and is restricted to permitted yast-ai HTTPS repositories.
