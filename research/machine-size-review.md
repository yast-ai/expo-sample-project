# 16-vCPU machine comparison

Research only, 2026-10-08. No 16-vCPU build has been run.

Boat officially lists large 8 vCPU/16 GB at $0.072 per hour and xlarge 16 vCPU/32 GB at $0.200 per hour. Xlarge requires the $100 plan or higher; current machine docs say no operator request is needed. https://docs.boat.dev/machines

The additional CPU capacity could accelerate all-ABI C++ compilation and parallel JVM tasks, provided actual guest throughput increases. Extra RAM permits more concurrent compilers and larger JVM heaps with more headroom. Dependencies, task serialization, fixed EAS work and packaging still limit whole-build scaling. Gradle workers are not a global Ninja concurrency limit.

Measured fastest source-cold EAS durations are Native 430.866 seconds and Disposabl 850.353 seconds. Reaching 300/500 seconds requires at least 1.44x/1.70x whole-build speedup. Under an idealized two-times speedup of scalable work with unchanged serial work, the scalable fractions would need to exceed 60.7%/82.4%. These are mathematical requirements, not measured fractions or forecasts.

Xlarge costs 2.78 times as much per second. It must finish in under 36% of the large-machine duration, over 64% less time, to reduce raw VM cost at these rates. Doubling compute alone does not ordinarily provide that cost reduction; test elapsed time and cost separately.

Recommended comparison: restore the same tools-only public template to fresh large/xlarge machines, keep source, dependency locks, ABIs, release settings and cache boundaries identical, and first hold worker/heap configuration fixed to isolate hardware. Then test higher worker concurrency on xlarge separately, with actual Ninja/process counts, phase timing, guest compute/steal, memory availability/PSI, GC and ABI/runtime verification. Do not call a six-worker run evidence that all 16 CPUs were fully used. No guaranteed under-300/under-500 claim follows from machine size.
