import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function createSampler({ fsImpl = fs, execFileSyncImpl = execFileSync, now = Date.now } = {}) {
  let previous;
  let diskUsed = 0;
  let ticks = 0;
  function sample(out, phaseFile) {
    const cpu = fsImpl.readFileSync('/proc/stat', 'utf8').split('\n')[0].trim().split(/\s+/).slice(1, 9).map(Number);
    const total = cpu.reduce((sum, value) => sum + value, 0), idle = cpu[3] + cpu[4];
    const utilization = previous ? 100 * (1 - (idle - previous.idle) / (total - previous.total)) : null;
    previous = { total, idle };
    const memory = Object.fromEntries([...fsImpl.readFileSync('/proc/meminfo', 'utf8').matchAll(/^(\w+):\s+(\d+)/gm)].map((match) => [match[1], Number(match[2])]));
    if (ticks++ % 5 === 0) diskUsed = Number(execFileSyncImpl('df', ['-B1', '--output=used', '/'], { encoding: 'utf8' }).trim().split('\n').at(-1));
    const oom = Number(fsImpl.readFileSync('/proc/vmstat', 'utf8').match(/^oom_kill (\d+)/m)?.[1] || 0);
    let phase = 'setup'; try { phase = fsImpl.readFileSync(phaseFile, 'utf8').trim() || phase; } catch {}
    const record = { time: now(), phase, cpu: utilization, memoryUsed: (memory.MemTotal - memory.MemAvailable) * 1024, memoryAvailable: memory.MemAvailable * 1024, memoryTotal: memory.MemTotal * 1024, diskUsed, swapUsed: (memory.SwapTotal - memory.SwapFree) * 1024, oom };
    fsImpl.appendFileSync(out, `${JSON.stringify(record)}\n`);
    return record;
  }
  return { sample };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [out, phaseFile] = process.argv.slice(2);
  if (!out || !phaseFile) throw new Error('Usage: public-eas-sampler.mjs <output.ndjson> <phase-file>');
  const sampler = createSampler();
  sampler.sample(out, phaseFile);
  setInterval(() => sampler.sample(out, phaseFile), 1000);
}
