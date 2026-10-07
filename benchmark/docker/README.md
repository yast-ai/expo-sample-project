# Docker Android build comparison

This lane measures a preview APK on the same Boat large VM used by the raw benchmark. The image has Node 24, Bun 1.4.2, and JDK 17. It mounts the VM's Android SDK 36 read-only, so image preparation does not download a second SDK.

The first and second builds use the same container image and `/cache/gradle` mount. Each uses a new `EAS_LOCAL_BUILD_WORKINGDIR`. The warm label therefore means a warm Bun and Gradle cache, not a reused EAS work directory.

`run-inside-container.sh` applies the same six Gradle workers, 4 GiB Gradle heap, and 1 GiB Kotlin daemon heap as the baseline. The host samples CPU, RAM, disk, and swap while Docker runs.

The runner records setup, image preparation, per-build EAS, checksum/upload preparation, and end-to-end timestamps. The orchestrator records Boat provision time around VM creation and artifact transfer time around Boat downloads.
