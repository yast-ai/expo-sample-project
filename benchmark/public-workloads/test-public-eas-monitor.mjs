import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { monitorJobs, parseSamples, redactSnapshot } from './public-eas-monitor.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'public-monitor-'));
const jobsDir = path.join(root, 'jobs');
const outputDir = path.join(root, 'evidence');
fs.mkdirSync(jobsDir);
const receipt = { bytes: 9, sha256: 'abc', buildStart: 10, buildEnd: 20, uploadStart: 25, uploadEnd: 30 };
const metrics = JSON.stringify({ time: 15, cpu: 45, memoryUsed: 100, memoryAvailable: 900, diskUsed: 50, swapUsed: 2, oom: 0 }) + '\n';
async function runCase(name, { log = 'SUCCESS\n', receiptValue = receipt, size = 9, captureFails = false, starts = false, verifiedBeforeCapture = false, stop404 = false, publicationFailsOnce = false, now = () => 40, wait = async () => {} }) {
  const job = { id: `public-${name}`, createdAt: 1, sandboxRequestedAt: 2, sandboxId: `bx_${name}`, status: 'started', runs: [{ cache: 'cold', status: 'queued', storageKey: `benchmarks/${name}/cold.apk` }] };
  if (verifiedBeforeCapture) Object.assign(job.runs[0], { status: 'success', artifactReceiptVerified: true, artifactSizeVerified: true });
  fs.writeFileSync(path.join(jobsDir, `${job.id}.json`), JSON.stringify(job));
  let stops = 0;
  const api = {
    async get() { return { sandbox: { state: 'running', setupStatus: 'completed' } }; },
    async command() {
      if (captureFails) throw new Error('capture unavailable');
      return { exitCode: 0, stdout: JSON.stringify({ phase: starts ? 'cold' : 'complete', log, 'metrics.ndjson': metrics, 'cold.start': starts && '10', 'cold.receipt': receiptValue && JSON.stringify(receiptValue), 'cold-tasks.ndjson': '{"task":":app:assembleRelease"}\n' }) };
    },
    async stop() { stops++; if (stop404) throw Object.assign(new Error('absent'), { response: { status: 404 } }); },
  };
  let publications = 0;
  const [result] = await monitorJobs({ api, jobsDir, outputDir, completeArtifact: () => { publications++; if (publicationFailsOnce && publications === 1) throw new Error('temporary metadata unavailable'); return { size }; }, pollMs: 0, maxMs: 100, now, wait });
  assert.equal(stops, 1, `${name}: terminal job must stop`);
  return result;
}
const success = await runCase('success', {});
assert.equal(success.status, 'success');
assert.equal(success.runs[0].artifactReceiptVerified, true);
assert.equal(success.runs[0].durationSeconds, 0.01);
assert.equal(success.runs[0].artifactUploadSeconds, 0.005);
assert.match(success.runs[0].artifactUrl, /benchmarks%2Fsuccess%2Fcold\.apk/);
assert.ok(fs.existsSync(path.join(outputDir, 'public-success', 'tasks-cold.ndjson')));
const errorLog = await runCase('error-log', { log: 'ERROR\n', receiptValue: null });
assert.equal(errorLog.status, 'error');
const mismatch = await runCase('mismatch', { log: 'still building\n', size: 8 });
assert.equal(mismatch.status, 'error');
assert.match(mismatch.runs[0].error, /size mismatch/);
const captureFailure = await runCase('capture-failure', { captureFails: true });
assert.equal(captureFailure.status, 'error');
assert.match(captureFailure.captureError, /capture unavailable/);
let liveNow = 0;
const live = await runCase('live', { log: 'still building\n', receiptValue: null, starts: true, size: 9, now: () => liveNow, wait: async () => { liveNow = 101; } });
assert.equal(live.runs[0].buildStartedAt, 10);
assert.equal(live.runs[0].status, 'cancelled');
const retried = await runCase('publication-retry', { publicationFailsOnce: true });
assert.equal(retried.status, 'success');
assert.equal(retried.runs[0].receiptRetries, 1);
const absent = await runCase('absent-after-upload', { captureFails: true, verifiedBeforeCapture: true, stop404: true });
assert.equal(absent.status, 'success');
assert.equal(absent.stopped, true);
assert.equal(absent.sandboxAbsent, true);
assert.deepEqual(parseSamples(metrics + '{"time":'), parseSamples(metrics));
assert.throws(() => parseSamples('{bad}\n' + metrics));
const secret = 'synthetic-test-token';
assert.equal(redactSnapshot({ log: secret + ' ' + Buffer.from(secret).toString('base64') }, [secret]).log, '[REDACTED] [REDACTED]');
const monitorSource = fs.readFileSync(new URL('./public-eas-monitor.mjs', import.meta.url), 'utf8');
assert.ok(!monitorSource.includes('.create('), 'monitor must never provision');
console.log('public monitor handles success, error, mismatch, and capture failure without provisioning');
