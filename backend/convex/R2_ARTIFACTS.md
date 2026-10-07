# R2 build artifacts

Build VMs upload directly to an `@convex-dev/r2` presigned PUT URL. Upload URLs last one hour so a long native build can upload after compilation. Convex syncs metadata only after polling confirms the VM receipt, and generates download URLs from the stored key. Existing Convex Storage IDs remain readable for old builds. `GET /artifact?id=<buildId>` redirects to a newly generated signed URL without proxying artifact bytes through Convex. Benchmark controllers use `GET /benchmark-artifact?key=benchmarks/...` for the same fresh redirect.

The flow intentionally does not use `r2.store`, which would materialize an artifact as a Blob in a Convex action. Uploads are a single non-resumable PUT today. Add S3 multipart upload before supporting artifacts around 1 GB or any interrupted long transfer.
