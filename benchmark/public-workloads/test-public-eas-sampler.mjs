import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createSampler } from './public-eas-sampler.mjs';

const writes = [];
let statReads = 0;
const fsImpl = {
  readFileSync(file) {
    if (file === '/proc/stat') return statReads++ === 0 ? 'cpu  10 0 0 50 10 0 0 0\n' : 'cpu  30 0 0 60 20 0 0 0\n';
    if (file === '/proc/meminfo') return 'MemTotal:       1000 kB\nMemAvailable:    400 kB\nSwapTotal:        200 kB\nSwapFree:          50 kB\n';
    if (file === '/proc/vmstat') return 'oom_kill 7\n';
    if (file === '/phase') return 'warm\n';
    throw new Error(`unexpected read ${file}`);
  },
  appendFileSync(file, value) { writes.push([file, value]); },
};
const sampler = createSampler({ fsImpl, execFileSyncImpl: () => 'Used\n123456\n', now: () => 42 });
const first = sampler.sample('/metrics.ndjson', '/phase');
const second = sampler.sample('/metrics.ndjson', '/phase');
for (const key of ['time', 'cpu', 'memoryUsed', 'memoryAvailable', 'diskUsed', 'swapUsed', 'oom']) assert.ok(key in second, `missing ${key}`);
assert.equal(first.cpu, null);
assert.equal(second.cpu, 50);
assert.deepEqual(JSON.parse(writes[1][1]), second);
assert.equal(second.diskUsed, 123456);
assert.equal(second.oom, 7);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'public-sampler-'));
const output = path.join(temp, 'metrics.ndjson');
const phase = path.join(temp, 'phase');
const preload = path.join(temp, 'mock-linux.cjs');
fs.writeFileSync(preload, `
const fs = require('fs');
const read = fs.readFileSync;
fs.readFileSync = (file, encoding) => {
  if (file === '/proc/stat') return 'cpu  10 0 0 50 10 0 0 0\\n';
  if (file === '/proc/meminfo') return 'MemTotal: 1000 kB\\nMemAvailable: 400 kB\\nSwapTotal: 200 kB\\nSwapFree: 50 kB\\n';
  if (file === '/proc/vmstat') return 'oom_kill 0\\n';
  return read(file, encoding);
};
const exec = require('child_process');
exec.execFileSync = () => 'Used\\n123\\n';
`);
fs.writeFileSync(phase, 'warm\n');
const samplerPath = fileURLToPath(new URL('./public-eas-sampler.mjs', import.meta.url));
const child = spawn(process.execPath, ['--require', preload, samplerPath, output, phase], { stdio: 'ignore' });
await new Promise((resolve) => setTimeout(resolve, 1200));
assert.equal(child.exitCode, null, 'referenced sampler interval must keep its process alive');
child.kill();
await once(child, 'exit');
assert.ok(fs.readFileSync(output, 'utf8').trim().split('\n').length >= 2, 'sampler must write initial and interval records');
console.log('public sampler schema and referenced-timer liveness pass');
