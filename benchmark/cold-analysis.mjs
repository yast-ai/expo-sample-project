#!/usr/bin/env node
// Aggregate V3 cold-build evidence without exporting source paths, logs, or IDs.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const jobsDir = path.join(root, 'benchmark/jobs');
const evidenceDir = path.join(root, 'verification/benchmarks');
const output = path.join(root, 'research/cold-analysis.json');
const finite = n => Number.isFinite(n) ? n : null;
const number = n => n === null || n === undefined || n === '' ? null : Number.isFinite(Number(n)) ? Number(n) : null;
const read = file => fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const json = file => { try { return JSON.parse(read(file)); } catch { return null; } };

export function parseNdjson(text) {
  return text.split('\n').flatMap((line, index, lines) => {
    if (!line.trim()) return [];
    try { return [JSON.parse(line)]; }
    catch { return index === lines.length - 1 && !text.endsWith('\n') ? [] : []; }
  });
}
export function median(values) { const v = values.filter(Number.isFinite).sort((a,b)=>a-b); return !v.length ? null : v.length % 2 ? v[(v.length-1)/2] : (v[v.length/2-1]+v[v.length/2])/2; }
export function range(values) { const v = values.filter(Number.isFinite); return v.length ? {min: Math.min(...v), max: Math.max(...v)} : null; }
export function mergedSeconds(intervals) {
  const merged = [];
  for (const [start,end] of intervals.filter(x=>Number.isFinite(x[0])&&Number.isFinite(x[1])&&x[1]>=x[0]).sort((a,b)=>a[0]-b[0])) {
    const last = merged.at(-1); if (last && start <= last[1]) last[1] = Math.max(last[1], end); else merged.push([start,end]);
  }
  return merged.reduce((sum,[a,b])=>sum+(b-a)/1000,0);
}
export function taskCategory(name) {
  if (/cmake|ninja/i.test(name)) return 'native';
  if (/kotlin|javac|compile.*java|kapt/i.test(name)) return 'jvm';
  if (/r8|minify|shrink/i.test(name)) return 'r8';
  return 'other';
}
export function taskTiming(rows, start, end) {
  const seen = new Set(), groups = {native: [], jvm: [], r8: []};
  for (const row of rows) {
    const a = number(row.startEpochMs), b = number(row.endEpochMs), task = String(row.task || '');
    if (!task || a === null || b === null || b < a || (start && b < start) || (end && a > end)) continue;
    const key = `${task}\0${a}\0${b}\0${row.status ?? ''}`; if (seen.has(key)) continue; seen.add(key);
    const category = taskCategory(task); if (groups[category]) groups[category].push([Math.max(a,start ?? a), Math.min(b,end ?? b)]);
  }
  return Object.fromEntries(Object.entries(groups).map(([name, intervals]) => [name, {wallSeconds: intervals.length ? mergedSeconds(intervals) : null, taskWorkSeconds: intervals.length ? intervals.reduce((s,[a,b])=>s+(b-a)/1000,0) : null, n: intervals.length}]));
}
export function gcPauses(logSources, start, end) {
  if (!logSources.length) return {count: null, totalPauseMs: null};
  const seen = new Set(), pauses = [];
  for (const {id, text} of logSources) for (const line of text.split('\n')) {
    const match = line.match(/^\[([^\]]+)\].*?GC\((\d+)\).*?\bPause\b.*?\s([\d.]+)ms\s*$/);
    if (!match) continue;
    const epoch = Date.parse(match[1]), durationMs = Number(match[3]);
    if (!Number.isFinite(epoch) || !Number.isFinite(durationMs) || (start && epoch < start) || (end && epoch > end)) continue;
    // JVM GC IDs are process-local. Same PID copied into more than one capture is
    // one event; different PIDs with matching timestamps are distinct events.
    const key = `${id}:${epoch}:${match[2]}:${durationMs}`; if (seen.has(key)) continue; seen.add(key); pauses.push(durationMs);
  }
  return {count: pauses.length, totalPauseMs: pauses.reduce((a,b)=>a+b,0)};
}
export function gcThreadTicks(samples, start, end) {
  const first = {gc: new Map(), vm: new Map()}, last = {gc: new Map(), vm: new Map()};
  for (const sample of samples) {
    const time = number(sample.time); if (time === null || (start && time < start) || (end && time > end)) continue;
    for (const process of sample.processes ?? []) for (const thread of process.gcThreads ?? []) {
      const ticks = number(thread.cpuTicks); if (ticks === null) continue;
      // Older sampler rows lack tid; PID+name is the stable fallback.
      const kind = /VM Thread/i.test(thread.name ?? '') ? 'vm' : 'gc';
      const key = `${process.pid ?? '?'}:${thread.tid ?? thread.name ?? '?'}`;
      if (!first[kind].has(key)) first[kind].set(key, ticks); last[kind].set(key, ticks);
    }
  }
  const delta = kind => last[kind].size ? [...last[kind]].reduce((total,[key,ticks]) => total + Math.max(0, ticks - (first[kind].get(key) ?? ticks)), 0) : null;
  return {gcThreadCpuTicksDelta: delta('gc'), vmThreadCpuTicksDelta: delta('vm')};
}
export function metricsSummary(samples, start, end) {
  const selected = samples.filter(s => Number.isFinite(s.time) && (!start || s.time >= start) && (!end || s.time <= end));
  const avg = getter => { const v=selected.map(getter).filter(Number.isFinite); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; };
  const delta = getter => { const v=selected.map(getter).filter(Number.isFinite); return v.length > 1 ? v.at(-1)-v[0] : null; };
  return {samples:selected.length,cpuStealPercentAverage:avg(s=>number(s.cpuSteal)),ioWaitPercentAverage:avg(s=>number(s.ioWait)),psiCpuSomeAvg10Average:avg(s=>number(s.psi?.cpu?.avg10)),psiIoSomeAvg10Average:avg(s=>number(s.psi?.io?.avg10)),psiMemorySomeAvg10Average:avg(s=>number(s.psi?.memory?.avg10)),cgroupThrottleCountDelta:delta(s=>number(s.cgroup?.nr_throttled)),cgroupThrottledMicrosDelta:delta(s=>number(s.cgroup?.throttled_usec))};
}
export function ninjaObservedMax(samples, start, end) {
  let max = null;
  for (const sample of samples) if ((!start || sample.time >= start) && (!end || sample.time <= end)) for (const process of sample.processes ?? []) {
    if (process.comm !== 'ninja') continue;
    for (const arg of process.nativeArgs ?? []) { const match = String(arg).match(/^-j(\d+)$/); if (match) max = Math.max(max ?? 0, Number(match[1])); }
  }
  return max;
}
function filesRecursive(dir) { try { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?filesRecursive(path.join(dir,e.name)): [path.join(dir,e.name)]); } catch { return []; } }
function aggregate(rows) {
  const grouped = new Map();
  for (const row of rows) { const key = JSON.stringify([row.app,row.recipe]); if (!grouped.has(key)) grouped.set(key,[]); grouped.get(key).push(row); }
  return [...grouped.values()].map(group => {
    const first = group[0], fields = ['easWallSeconds','nativeWallSeconds','nativeTaskWorkSeconds','jvmWallSeconds','jvmTaskWorkSeconds','r8WallSeconds','r8TaskWorkSeconds','gcPauseCount','gcPauseTotalMs','gcThreadCpuTicksDelta','vmThreadCpuTicksDelta','ninjaObservedMax','cpuStealPercentAverage','ioWaitPercentAverage','psiCpuSomeAvg10Average','psiIoSomeAvg10Average','psiMemorySomeAvg10Average','cgroupThrottleCountDelta','cgroupThrottledMicrosDelta'];
    const result = {app:first.app,recipe:first.recipe,n:group.length,running:group.filter(x=>x.state==='running').length,completed:group.filter(x=>x.state==='success').length};
    for (const field of fields) { const values=group.map(x=>x[field]); result[field]={median:median(values),range:range(values),n:values.filter(Number.isFinite).length}; }
    return result;
  }).sort((a,b)=>`${a.app}:${a.recipe.id}`.localeCompare(`${b.app}:${b.recipe.id}`));
}
export function analyze({jobsDirectory=jobsDir, evidenceDirectory=evidenceDir}={}) {
  const rows=[];
  for (const file of fs.existsSync(jobsDirectory)?fs.readdirSync(jobsDirectory).filter(f=>/^cold-.*\.json$/.test(f)):[]) {
    const job=json(path.join(jobsDirectory,file)); if (job?.benchmarkVersion !== 3) continue;
    for (const run of job.runs ?? []) {
      if (!['success','in progress','publishing','running'].includes(run.status)) continue;
      const id=String(job.id||file.replace(/\.json$/,'')), dir=path.join(evidenceDirectory,id);
      const start=number(run.buildStartedAt), end=number(run.buildCompletedAt) ?? Date.now();
      const metrics=parseNdjson(read(path.join(dir,'metrics.ndjson'))), tasks=parseNdjson(read(path.join(dir,'tasks-cold.ndjson'))), processes=parseNdjson(read(path.join(dir,'processes.ndjson')));
      const timing=taskTiming(tasks,start,end), host=metricsSummary(metrics,start,end);
      const logs=filesRecursive(dir).filter(f=>/gc.*\.log$/i.test(path.basename(f))).map(file=>({id:path.basename(file).match(/gc-(\d+)/)?.[1] ?? path.basename(file),text:read(file)}));
      const gc=gcPauses(logs,start,end), ticks=gcThreadTicks(processes,start,end);
      rows.push({app:job.private?'private-app':String(job.project||'public-app').replace(/[^a-z0-9-]/gi,'').slice(0,40),recipe:{id:String(run.strategyId||job.strategyId||'unknown'),name:String(run.strategy?.name||job.strategy?.name||'Unknown'),workers:number(run.workers??job.workers),heapMiB:number(run.gradleHeapMiB??job.heap),pch:Boolean(run.pch),ninjaJobs:number(run.ninjaJobs)},state:run.status==='success'?'success':'running',easWallSeconds:start?Math.max(0,(end-start)/1000):null,nativeWallSeconds:timing.native.wallSeconds,nativeTaskWorkSeconds:timing.native.taskWorkSeconds,jvmWallSeconds:timing.jvm.wallSeconds,jvmTaskWorkSeconds:timing.jvm.taskWorkSeconds,r8WallSeconds:timing.r8.wallSeconds,r8TaskWorkSeconds:timing.r8.taskWorkSeconds,gcPauseCount:gc.count,gcPauseTotalMs:gc.totalPauseMs,...ticks,ninjaObservedMax:ninjaObservedMax(processes,start,end),...host});
    }
  }
  return {schemaVersion:1,generatedAt:new Date().toISOString(),scope:'benchmarkVersion=3 cold success and running runs only; no source paths, source content, logs, sandbox IDs, or source revisions',cpuTicks:{unit:'clock-ticks',clockTicksPerSecond:100,gcThreadKey:'PID plus tid, or PID plus name for older sampler rows'},recipes:aggregate(rows),runCount:rows.length};
}
export function selfTest() {
  if (metricsSummary([{time:1,cpuSteal:null,cgroup:null}],0,2).cpuStealPercentAverage !== null) throw Error('unavailable metric must not become zero');
  const intervals=[[0,100],[50,150],[500,600]]; if (mergedSeconds(intervals)!==0.25) throw Error('overlap merge regression');
  const tasks=taskTiming([{task:':a:configureCMake',startEpochMs:0,endEpochMs:100},{task:':a:configureCMake',startEpochMs:0,endEpochMs:100},{task:':a:configureCMake',startEpochMs:50,endEpochMs:150}],0,200);
  if (tasks.native.wallSeconds!==0.15||tasks.native.taskWorkSeconds!==0.2||tasks.native.n!==2) throw Error('task de-dup regression');
  const gc=gcPauses([{id:'42',text:'[2026-01-01T00:00:01.000+0000][1.0s][info][gc] GC(1) Pause Young 2.500ms'},{id:'42',text:'[2026-01-01T00:00:01.000+0000][1.0s][info][gc] GC(1) Pause Young 2.500ms'}],Date.parse('2026-01-01T00:00:00Z'),Date.parse('2026-01-01T00:00:02Z'));
  if (gc.count!==1||gc.totalPauseMs!==2.5) throw Error('GC de-dup regression');
  const normalized=aggregate([{app:'public-app',recipe:{id:'A'},state:'success',gcPauseCount:1,gcPauseTotalMs:2,gcThreadCpuTicksDelta:5,vmThreadCpuTicksDelta:7},{app:'public-app',recipe:{id:'A'},state:'success',gcPauseCount:3,gcPauseTotalMs:4,gcThreadCpuTicksDelta:9,vmThreadCpuTicksDelta:11}])[0];
  if (normalized.gcPauseCount.median!==2||normalized.gcPauseTotalMs.range.max!==4||normalized.gcThreadCpuTicksDelta.median!==7) throw Error('normalized GC aggregation regression');
}
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv[2] === '--test') { selfTest(); console.log('cold-analysis fixture: PASS'); }
  else { fs.mkdirSync(path.dirname(output),{recursive:true}); fs.writeFileSync(output,`${JSON.stringify(analyze(),null,2)}\n`); console.log(output); }
}
