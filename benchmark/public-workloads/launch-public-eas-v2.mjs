import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { monitorJobs } from './public-eas-monitor.mjs';

const require = createRequire(import.meta.url);
const { BoatApi, Configuration } = require('../../backend/node_modules/@boatdev/sdk/dist/index.js');

const root = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(root, '../..');
const benchmarkRoot = path.resolve(process.env.BENCHMARK_ROOT || workspace);
const jobsDir = path.join(benchmarkRoot, 'benchmark/jobs');
const boatKey = process.env.BOAT_API_KEY;
const expoToken = process.env.EXPO_TOKEN;
if (!boatKey || !expoToken) throw new Error('BOAT_API_KEY and EXPO_TOKEN must be supplied by the authorized launcher environment.');
const api = new BoatApi(new Configuration({ accessToken: boatKey }));
const workloads = JSON.parse(fs.readFileSync(path.join(root, 'projects.json'), 'utf8')).projects;
const selected = new Set((process.env.BENCHMARK_WORKLOAD_IDS || '').split(',').filter(Boolean));
const selectedWorkloads = selected.size ? workloads.filter((workload) => selected.has(workload.id)) : workloads;
if (selected.size && selectedWorkloads.length !== selected.size) throw new Error('BENCHMARK_WORKLOAD_IDS contains an unknown workload.');
const template = process.env.BENCHMARK_TEMPLATE || 'android-build-tools-v3';
const support = [
  ['apply-eas-preview-overlay.mjs', path.join(root, 'apply-eas-preview-overlay.mjs')],
  ['projects.json', path.join(root, 'projects.json')],
  ['public-eas-sampler.mjs', path.join(root, 'public-eas-sampler.mjs')],
  ['public-eas-lane.sh', path.join(root, 'public-eas-lane.sh')],
  ['v4-preflight.sh', path.join(root, 'v4-preflight.sh')],
  ['gradle-task-telemetry.init.gradle', path.join(workspace, 'research/gradle-task-telemetry.init.gradle')],
].map(([name, file]) => [name, fs.readFileSync(file).toString('base64')]);
const writeSupport = support.map(([name, content]) => `fs.writeFileSync(${JSON.stringify(`/home/user/support/${name}`)},Buffer.from(${JSON.stringify(content)},'base64'));`).join('');
const convex = (fn, args) => JSON.parse(execFileSync('bunx', ['convex', 'run', fn, JSON.stringify(args)], {
  cwd: path.join(workspace, 'backend'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}));
const now = Date.now();
const launchedIds = await Promise.all(selectedWorkloads.map(async (workload, index) => {
  const actionRequestedAt = Date.now();
  const id = `public-${workload.id}-v2-${now + index}`;
  const jobPath = path.join(jobsDir, `${id}.json`);
  const key = (cache) => `benchmarks/${id}/${cache}.apk`;
  const job = {
    id, project: workload.id, profile: 'preview', lane: 'public-v2', workers: 6, gradleHeapMiB: 4096,
    cacheMode: 'same VM; persistent package/Gradle caches; EAS chooses fresh local working directories', taskOutputCachingConfigured: true,
    sourceURL: workload.sourceURL, sourceSha: workload.sourceSHA, easProjectId: workload.easProjectId, template,
    status: 'starting', createdAt: Date.now(), actionRequestedAt, runs: ['cold', 'warm'].map((cache) => ({ cache, status: 'queued', storageKey: key(cache) })),
  };
  fs.writeFileSync(jobPath, JSON.stringify(job, null, 2));
  const coldUpload = convex('artifacts:benchmarkUpload', { key: key('cold') }).url;
  const warmUpload = convex('artifacts:benchmarkUpload', { key: key('warm') }).url;
  const setupScript = `#!/usr/bin/env bash
set -Eeuo pipefail
exec > >(TZ=UTC awk '{ print strftime("[%Y-%m-%dT%H:%M:%SZ]"), $0; fflush() }' >> /home/user/build.log) 2>&1
trap 'rc=$?; if [ "$rc" -eq 0 ]; then echo SUCCESS; else echo ERROR; fi' EXIT
mkdir -p /home/user/support /home/user/benchmark
node -e ${JSON.stringify(`const fs=require('fs');${writeSupport}`)}
chmod +x /home/user/support/public-eas-lane.sh
chmod +x /home/user/support/v4-preflight.sh
if [[ ${JSON.stringify(template)} == android-build-tools-v4 ]]; then /home/user/support/v4-preflight.sh; fi
java -version
node --version
bun --version
test -x /home/user/android-sdk/build-tools/36.0.0/aapt2
/home/user/android-sdk/build-tools/36.0.0/aapt2 version
export WORKLOAD_ID=${JSON.stringify(workload.id)} BENCHMARK_SUPPORT_DIR=/home/user/support
bash /home/user/support/public-eas-lane.sh
`;
  try {
    job.sandboxRequestedAt = Date.now();
    const result = await api.create({
      idempotencyKey: id,
      createSandboxRequest: {
        type: 'large', ttlSeconds: 3600, noEnv: true, snapshots: false,
        from: template,
        env: { EXPO_TOKEN: expoToken, BENCHMARK_UPLOAD_COLD_URL: coldUpload, BENCHMARK_UPLOAD_WARM_URL: warmUpload },
        setupScript,
      },
    });
    job.sandboxId = result.sandbox.id; job.status = 'started';
  } catch (error) { job.status = 'error'; job.error = String(error.message || error); }
  fs.writeFileSync(jobPath, JSON.stringify(job, null, 2));
  console.log(`${workload.id}\t${job.status}\t${job.sandboxId ?? job.error}`);
  return id;
}));
await monitorJobs({
  api,
  jobIds: launchedIds,
  jobsDir,
  outputDir: path.join(benchmarkRoot, 'verification/benchmarks'),
  completeArtifact: (key) => convex('artifacts:completeUpload', { key }),
});
