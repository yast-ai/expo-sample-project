import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { summarize } from '../metrics.mjs';

const terminalStates = new Set(['error', 'archived', 'cancelled', 'stopped', 'expired']);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const transient = (error) => error?.response?.status === 429 || error?.response?.status >= 500 || /timeout|ECONNRESET/i.test(String(error?.message || error));
const remoteSnapshot = `node -e 'const fs=require("fs"),p="/home/user/benchmark/",r={};for(const n of ["phase","metrics.ndjson","cold.start","cold.end","cold.receipt","cold-tasks.ndjson","warm.start","warm.end","warm.receipt","warm-tasks.ndjson"]){try{r[n]=fs.readFileSync(p+n,"utf8")}catch{}}try{r.log=fs.readFileSync("/home/user/build.log","utf8")}catch{};console.log(JSON.stringify(r))'`;

export function redactSnapshot(snapshot, secrets = []) {
  const values = secrets.filter(Boolean).flatMap(secret => [secret, Buffer.from(secret).toString('base64'), Buffer.from(secret).toString('base64url')]);
  return Object.fromEntries(Object.entries(snapshot).map(([key, value]) => [key, typeof value === 'string' ? values.reduce((text, secret) => text.split(secret).join('[REDACTED]'), value) : value]));
}

export function parseSamples(raw = '') {
  const lines = raw.split('\n');
  return lines.flatMap((line, index) => {
    if (!line.trim()) return [];
    try { return [JSON.parse(line)]; }
    catch (error) { if (index === lines.length - 1 && !raw.endsWith('\n')) return []; throw error; }
  });
}

function writeEvidence(output, snapshot) {
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'build.log'), snapshot.log || '');
  fs.writeFileSync(path.join(output, 'metrics.ndjson'), snapshot['metrics.ndjson'] || '');
  for (const cache of ['cold', 'warm']) {
    fs.writeFileSync(path.join(output, `tasks-${cache}.ndjson`), snapshot[`${cache}-tasks.ndjson`] || '');
  }
}

function applyLiveRuns(job, snapshot) {
  for (const run of job.runs || []) {
    const start = Number(snapshot[`${run.cache}.start`]);
    const end = Number(snapshot[`${run.cache}.end`]);
    if (!start) continue;
    run.triggeredAt ||= run.cache === 'cold' ? job.actionRequestedAt || job.sandboxRequestedAt || job.createdAt : start;
    run.buildStartedAt ||= start;
    if (end) {
      run.buildCompletedAt ||= end;
      if (run.status === 'queued' || run.status === 'in progress') run.status = 'publishing';
    } else if (run.status === 'queued') run.status = 'in progress';
  }
}

function applyReceipts(job, snapshot, completeArtifact, samples, now) {
  for (const run of job.runs || []) {
    const raw = snapshot[`${run.cache}.receipt`];
    if (!raw || run.artifactReceiptVerified) continue;
    try {
      const receipt = JSON.parse(raw);
      const completed = completeArtifact(run.storageKey);
      if (!completed || completed.size !== receipt.bytes) throw Object.assign(new Error(`artifact receipt size mismatch for ${run.cache}`), { receiptMismatch: true });
      const artifactReadyAt = now();
      const triggeredAt = run.triggeredAt || (run.cache === 'cold' ? job.actionRequestedAt || job.sandboxRequestedAt || job.createdAt : receipt.buildStart);
      Object.assign(run, {
        status: 'success', artifactSha256: receipt.sha256, artifactBytes: receipt.bytes,
        artifactReceiptVerified: true, artifactSizeVerified: true, artifactMiB: receipt.bytes / 2 ** 20,
        buildStartedAt: receipt.buildStart, buildCompletedAt: receipt.buildEnd,
        uploadStartedAt: receipt.uploadStart, uploadCompletedAt: receipt.uploadEnd,
        artifactReadyAt, artifactUploadSeconds: (receipt.uploadEnd - receipt.uploadStart) / 1000,
        fullPublishSeconds: (artifactReadyAt - receipt.buildEnd) / 1000,
        endToEndSeconds: (artifactReadyAt - triggeredAt) / 1000,
        provisionSetupSeconds: (receipt.buildStart - triggeredAt) / 1000,
        pollingAndPublishSeconds: (artifactReadyAt - receipt.uploadEnd) / 1000,
        artifactUrl: `https://quaint-magpie-201.convex.site/benchmark-artifact?key=${encodeURIComponent(run.storageKey)}`,
      });
      Object.assign(run, summarize(samples, receipt.buildStart, receipt.buildEnd));
    } catch (error) {
      run.receiptRetries = (run.receiptRetries || 0) + 1;
      if (!error.receiptMismatch && run.receiptRetries <= 3) { run.status = 'publishing'; run.publicationWarning = String(error.message || error); }
      else { run.status = 'error'; run.error = String(error.message || error); }
    }
  }
}

export async function monitorJobs({ api, jobsDir, outputDir, jobIds, secrets = [process.env.EXPO_TOKEN].filter(Boolean), completeArtifact = () => null, pollMs = 15_000, maxMs = 3_300_000, now = Date.now, wait = sleep }) {
  const jobs = fs.readdirSync(jobsDir).filter((name) => name.startsWith('public-') && name.endsWith('.json')).map((name) => ({ path: path.join(jobsDir, name), job: JSON.parse(fs.readFileSync(path.join(jobsDir, name), 'utf8')) })).filter(({ job }) => (!jobIds || jobIds.includes(job.id)) && job.sandboxId && !job.stopped && ['started', 'in progress', 'starting'].includes(job.status));
  const command = async (sandboxId) => {
    for (let attempt = 0; ; attempt++) try {
      const result = await api.command({ sandboxId, commandRequest: { command: remoteSnapshot, timeoutSeconds: 30 } });
      if (!('stdout' in result) || result.exitCode !== 0) throw new Error(`snapshot command failed: ${result.exitCode}`);
      return redactSnapshot(JSON.parse(result.stdout || '{}'), secrets);
    } catch (error) { if (!transient(error) || attempt === 2) throw error; await wait(15_000); }
  };
  const save = (entry) => fs.writeFileSync(entry.path, JSON.stringify(entry.job, null, 2));
  const finalize = async (entry, reason) => {
    const output = path.join(outputDir, entry.job.id);
    try {
      const snapshot = await command(entry.job.sandboxId);
      writeEvidence(output, snapshot);
      applyLiveRuns(entry.job, snapshot);
      const samples = parseSamples(snapshot['metrics.ndjson']);
      applyReceipts(entry.job, snapshot, completeArtifact, samples, now);
      entry.job.phase = (snapshot.phase || entry.job.phase || 'unknown').trim();
      entry.job.logTail = (snapshot.log || '').slice(-4000);
      if (/\bERROR\s*$/.test(snapshot.log || '')) entry.job.status = 'error';
      else if ((entry.job.runs || []).every((run) => run.status === 'success')) entry.job.status = 'success';
    } catch (error) {
      entry.job.captureError = String(error.message || error);
    } finally {
      try { await api.stop({ sandboxId: entry.job.sandboxId }); entry.job.stopped = true; } catch (error) { if (error?.response?.status === 404) { entry.job.stopped = true; entry.job.sandboxAbsent = true; } else entry.job.stopError = String(error.message || error); }
      if (entry.job.runs?.length && entry.job.runs.every(run => run.status === 'success' && run.artifactReceiptVerified)) entry.job.status = 'success';
      else if (entry.job.status !== 'success') entry.job.status = (entry.job.runs || []).some((run) => run.status === 'success') ? 'partial' : 'error';
      for (const run of entry.job.runs || []) if (!['success', 'error'].includes(run.status)) run.status = 'cancelled';
      entry.job.terminalReason = reason;
      entry.job.finishedAt = now();
      save(entry);
    }
  };

  const deadline = now() + maxMs;
  while (jobs.some((entry) => !entry.job.stopped) && now() < deadline) {
    await Promise.all(jobs.filter((entry) => !entry.job.stopped).map(async (entry) => {
      try {
        let sandbox;
        for (let attempt = 0; ; attempt++) try { sandbox = (await api.get({ sandboxId: entry.job.sandboxId })).sandbox; break; } catch (error) { if (!transient(error) || attempt === 2) throw error; await wait(15_000); }
        entry.job.boatState = sandbox.state;
        entry.job.setupStatus = sandbox.setupStatus;
        if (terminalStates.has(sandbox.state) || sandbox.setupStatus === 'failed') return finalize(entry, sandbox.setupError || sandbox.error || sandbox.state);
        const snapshot = await command(entry.job.sandboxId);
        writeEvidence(path.join(outputDir, entry.job.id), snapshot);
        applyLiveRuns(entry.job, snapshot);
        const samples = parseSamples(snapshot['metrics.ndjson']);
        applyReceipts(entry.job, snapshot, completeArtifact, samples, now);
        entry.job.phase = (snapshot.phase || 'setup').trim();
        entry.job.status = 'in progress';
        save(entry);
        const failedRun = (entry.job.runs || []).find((run) => run.status === 'error');
        if (failedRun) return finalize(entry, failedRun.error || `${failedRun.cache} receipt failed`);
        if (/\bERROR\s*$/.test(snapshot.log || '') || (/\bSUCCESS\s*$/.test(snapshot.log || '') && !(entry.job.runs || []).some(run => run.status === 'publishing' && run.receiptRetries)) || (entry.job.runs || []).every((run) => run.status === 'success')) return finalize(entry, 'build terminal');
      } catch (error) {
        entry.job.status = 'error';
        entry.job.error = String(error.message || error);
        for (const run of entry.job.runs || []) if (!['success', 'error'].includes(run.status)) run.status = 'error';
        await finalize(entry, 'monitor error');
      }
    }));
    if (jobs.some((entry) => !entry.job.stopped)) await wait(pollMs);
  }
  await Promise.all(jobs.filter((entry) => !entry.job.stopped).map((entry) => finalize(entry, 'monitor deadline')));
  return jobs.map(({ job }) => job);
}

async function main() {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const workspace = path.resolve(root, '../..');
  const benchmarkRoot = path.resolve(process.env.BENCHMARK_ROOT || workspace);
  const require = createRequire(import.meta.url);
  const { BoatApi, Configuration } = require('../../backend/node_modules/@boatdev/sdk/dist/index.js');
  const boatKey = process.env.BOAT_API_KEY;
  if (!boatKey) throw new Error('BOAT_API_KEY must be supplied by the authorized launcher environment.');
  const api = new BoatApi(new Configuration({ accessToken: boatKey }));
  const completeArtifact = (key) => JSON.parse(execFileSync('bunx', ['convex', 'run', 'artifacts:completeUpload', JSON.stringify({ key })], { cwd: path.join(workspace, 'backend'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  await monitorJobs({ api, jobsDir: path.join(benchmarkRoot, 'benchmark/jobs'), outputDir: path.join(benchmarkRoot, 'verification/benchmarks'), completeArtifact });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
