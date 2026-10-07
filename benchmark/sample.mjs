import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const out = process.argv[2], phaseFile = process.argv[3];
let previous, disk = 0, ticks = 0;
function sample() {
  const cpu = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0].trim().split(/\s+/).slice(1, 9).map(Number);
  const total = cpu.reduce((a, b) => a + b, 0), idle = cpu[3] + cpu[4];
  const utilization = previous ? 100 * (1 - (idle - previous.idle) / (total - previous.total)) : null;
  previous = { total, idle };
  const memory = Object.fromEntries([...fs.readFileSync('/proc/meminfo', 'utf8').matchAll(/^(\w+):\s+(\d+)/gm)].map(m => [m[1], Number(m[2])]));
  if (ticks++ % 5 === 0) disk = Number(execFileSync('df', ['-B1', '--output=used', '/'], { encoding: 'utf8' }).trim().split('\n').at(-1));
  const oom = Number(fs.readFileSync('/proc/vmstat', 'utf8').match(/^oom_kill (\d+)/m)?.[1] || 0);
  let phase = 'setup'; try { phase = fs.readFileSync(phaseFile, 'utf8').trim(); } catch {}
  fs.appendFileSync(out, JSON.stringify({ time: Date.now(), phase, cpu: utilization, memoryUsed: (memory.MemTotal - memory.MemAvailable) * 1024, memoryAvailable: memory.MemAvailable * 1024, memoryTotal: memory.MemTotal * 1024, swapUsed: (memory.SwapTotal - memory.SwapFree) * 1024, diskUsed: disk, oom }) + '\n');
}
sample(); setInterval(sample, 1000);
