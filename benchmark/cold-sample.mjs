import fs from 'node:fs';

const [metricsFile, phaseFile, processesFile] = process.argv.slice(2);
if (!metricsFile || !phaseFile || !processesFile) throw Error('usage: cold-sample metrics phase processes');
const read = path => fs.readFileSync(path, 'utf8');
const cpu = () => read('/proc/stat').split('\n').filter(x => /^cpu\d+ /.test(x)).map(line => {
  const [name, ...v] = line.trim().split(/\s+/); const n = v.map(Number);
  const total = n.slice(0, 8).reduce((a, b) => a + b, 0), busy = (n[0] || 0) + (n[1] || 0) + (n[2] || 0) + (n[5] || 0) + (n[6] || 0), steal = n[7] || 0, ioWait = n[4] || 0;
  return { name, total, busy, steal, ioWait };
});
const mem = () => Object.fromEntries(read('/proc/meminfo').split('\n').flatMap(l => { const m = l.match(/^(MemAvailable|MemTotal|SwapTotal|SwapFree):\s+(\d+)/); return m ? [[m[1], Number(m[2]) * 1024]] : []; }));
const psi = kind => { try { const m = read(`/proc/pressure/${kind}`).match(/some avg10=([\d.]+).*?avg60=([\d.]+).*?avg300=([\d.]+)/); return m ? { avg10:+m[1], avg60:+m[2], avg300:+m[3] } : null; } catch { return null; } };
const cgroup = () => { try { const s = read('/sys/fs/cgroup/cpu.stat'); return Object.fromEntries(s.trim().split('\n').map(l => l.split(' ')).filter(x => x.length === 2)); } catch { return {}; } };
const diskUsed = () => { try { const s = fs.statfsSync('/'); return (s.blocks - s.bfree) * s.bsize; } catch { return 0; } };
const oom = () => { try { return +(read('/sys/fs/cgroup/memory.events').match(/^oom_kill\s+(\d+)/m)?.[1] || 0); } catch { return 0; } };
const processes = () => fs.readdirSync('/proc').flatMap(pid => {
  if (!/^\d+$/.test(pid)) return []; try { const comm = read(`/proc/${pid}/comm`).trim(); if (!/^(java|node|clang\+\+|clang|ninja|cmake)$/.test(comm)) return []; const status = read(`/proc/${pid}/status`), fields=text=>text.slice(text.lastIndexOf(')')+2).trim().split(/\s+/), stat=fields(read(`/proc/${pid}/stat`)), args=/^(ninja|cmake)$/.test(comm)?read(`/proc/${pid}/cmdline`).split('\0'):[], raw=args.flatMap((x,i)=>x==='-j'&&/^\d+$/.test(args[i+1])?[`-j${args[i+1]}`]:/^-j\d+$|^-[A-Za-z]*CMAKE/i.test(x)?[x]:[]), gcThreads=comm==='java'?fs.readdirSync(`/proc/${pid}/task`).flatMap(tid=>{try{const ts=fields(read(`/proc/${pid}/task/${tid}/stat`)), name=read(`/proc/${pid}/task/${tid}/comm`).trim();return /GC|G1|VM Thread/.test(name)?[{name,cpuTicks:+ts[11]+ +ts[12]}]:[]}catch{return []}}):[]; const rss = +(status.match(/^VmRSS:\s+(\d+)/m)?.[1] || 0) * 1024, threads = +(status.match(/^Threads:\s+(\d+)/m)?.[1] || 0); return [{ pid:+pid, parentPid:+stat[1], comm, rssBytes:rss, threads, cpuTicks:+stat[11] + +stat[12], majorFaults:+stat[9], nativeArgs:raw, gcThreads }]; } catch { return []; }
});
let previous = cpu();
const tick = () => { const now = cpu(), byName = new Map(previous.map(x => [x.name, x])), perCpu = now.map(x => { const p = byName.get(x.name) || x, total = x.total - p.total; return { name:x.name, busyPct:total ? 100 * (x.busy - p.busy) / total : 0, stealPct:total ? 100 * (x.steal - p.steal) / total : 0, ioWaitPct:total ? 100 * (x.ioWait - p.ioWait) / total : 0 }; }), cpuBusy=perCpu.reduce((s,x)=>s+x.busyPct,0)/Math.max(1,perCpu.length), cpuSteal=perCpu.reduce((s,x)=>s+x.stealPct,0)/Math.max(1,perCpu.length), ioWait=perCpu.reduce((s,x)=>s+x.ioWaitPct,0)/Math.max(1,perCpu.length); previous = now; const m = mem(); const row = { time:Date.now(), phase:fs.existsSync(phaseFile) ? read(phaseFile).trim() : 'setup', cpu:cpuBusy, cpuSteal, ioWait, perCpu, memoryUsed:m.MemTotal - m.MemAvailable, memoryAvailable:m.MemAvailable, memoryTotal:m.MemTotal, swapUsed:m.SwapTotal - m.SwapFree, diskUsed:diskUsed(), oom:oom(), psi:{cpu:psi('cpu'),memory:psi('memory'),io:psi('io')}, cgroup:cgroup() }; fs.appendFileSync(metricsFile, JSON.stringify(row) + '\n'); fs.appendFileSync(processesFile, JSON.stringify({ time:row.time, phase:row.phase, processes:processes() }) + '\n'); };
tick(); setInterval(tick, 1000);
