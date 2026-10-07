import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { BoatApi, Configuration } from '../backend/node_modules/@boatdev/sdk/dist/esm/index.js';
import { summarize } from './metrics.mjs';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repo=fs.existsSync(path.join(root,'expo-sample-project/package.json'))?path.join(root,'expo-sample-project'):root;
const [project='native-heavy',config='raw-6w-4g',workerArg='6',heapArg='4096',warmWorkerArg=workerArg,warmHeapArg=heapArg]=process.argv.slice(2);
const workers=Number(workerArg),heap=Number(heapArg),warmWorkers=Number(warmWorkerArg),warmHeap=Number(warmHeapArg),profile='preview',lane='experiment',jobId=`${project}-${config}-${Date.now()}`;
if(![3,4,6,8].includes(workers)||![3,4,6,8].includes(warmWorkers)||![3072,4096,6144].includes(heap)||![3072,4096,6144].includes(warmHeap))throw Error('Unsupported experiment settings');
const sourceSha = execFileSync('git',['-C',repo,'rev-parse','origin/main'],{encoding:'utf8'}).trim();
const output = path.join(root, 'verification/benchmarks', jobId), jobs = path.join(root, 'benchmark/jobs');
fs.mkdirSync(output, { recursive: true }); fs.mkdirSync(jobs, { recursive: true });
const boatKey = fs.readFileSync('/private/tmp/expo-sample-boat-key', 'utf8').trim();
const expoToken = fs.readFileSync('/private/tmp/expo-build-token', 'utf8').trim();
const api = new BoatApi(new Configuration({ accessToken: boatKey }));
const convex=(fn,args)=>JSON.parse(execFileSync('bunx',['convex','run',fn,JSON.stringify(args)],{cwd:path.join(repo,'backend'),encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const job={id:jobId,project,profile,lane,config,workers,heap,warmWorkers,warmHeap,sourceSha,cacheMode:'Fresh VM; fresh EAS directory each run; persistent Bun/npm/Gradle caches',status:'starting',createdAt:Date.now(),runs:['cold','warm','warm2'].map(cache=>({project,profile,lane,config,workers:cache==='cold'?workers:warmWorkers,gradleHeapMiB:cache==='cold'?heap:warmHeap,kotlinHeapMiB:1024,cache,sourceSha,status:'queued'}))};

const safe = s => String(s).replaceAll(expoToken, '[EXPO_TOKEN]').replaceAll(boatKey, '[BOAT_API_KEY]');
const save = () => fs.writeFileSync(path.join(jobs, jobId + '.json'), JSON.stringify(job, null, 2));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function command(command, timeoutSeconds = 20) {
  for (let attempt = 0; ; attempt++) {
    try { const r = await api.command({ sandboxId: job.sandboxId, commandRequest: {command,timeoutSeconds} }); if (!('stdout' in r) || r.exitCode !== 0) throw Error(safe(JSON.stringify(r))); return r.stdout || ''; }
    catch(e) { if (attempt >= 3 || (e.response && e.response.status < 500)) throw e; await sleep(3000); }
  }
}
async function transfer(cache,data){
 const receipt=JSON.parse(data[`${cache}.receipt`]),key=`benchmarks/${jobId}/${cache}.apk`;
 const completed=convex('artifacts:completeUpload',{key}),ready=Date.now();
 return {artifactMiB:completed.size/2**20,artifactSha256:receipt.sha256,artifactVerified:false,artifactSizeVerified:completed.size===receipt.bytes,storageKey:key,artifactUrl:`https://quaint-magpie-201.convex.site/benchmark-artifact?key=${encodeURIComponent(key)}`,artifactUploadSeconds:(receipt.uploadEnd-receipt.uploadStart)/1000,uploadCompletedAt:receipt.uploadEnd,artifactReadyAt:ready};
}

save();
try {
  const folder = project === 'control' ? '/tmp/repo' : `/tmp/repo/variants/${project}`;
  const runner=fs.readFileSync(path.join(root,'benchmark/experiment-run.sh'),'utf8'),sampler=fs.readFileSync(path.join(repo,'benchmark/sample.mjs'),'utf8');
  const uploads={};for(const cache of ['cold','warm','warm2'])uploads[`BENCHMARK_UPLOAD_${cache.toUpperCase()}_URL`]=convex('artifacts:benchmarkUpload',{key:`benchmarks/${jobId}/${cache}.apk`}).url;
  const encode=s=>Buffer.from(s).toString('base64');
  const setupScript=`#!/usr/bin/env bash
set -Eeuo pipefail
exec > >(TZ=UTC awk '{ print strftime("[%Y-%m-%dT%H:%M:%SZ]"), $0; fflush() }' >> /home/user/build.log) 2>&1
trap 'rc=$?; if [ "$rc" -eq 0 ]; then echo SUCCESS; else echo ERROR; fi' EXIT
export EXPO_TOKEN JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ANDROID_HOME=/home/user/android-sdk ANDROID_SDK_ROOT=/home/user/android-sdk PATH="/home/user/.bun/bin:/home/user/android-sdk/cmdline-tools/latest/bin:/home/user/android-sdk/platform-tools:$PATH" BUN_INSTALL_CACHE_DIR=/tmp/bun-cache
node -e 'require("fs").writeFileSync("/tmp/experiment-run.sh",Buffer.from("${encode(runner)}","base64"));require("fs").writeFileSync("/tmp/sample.mjs",Buffer.from("${encode(sampler)}","base64"))'
git clone --depth 1 https://github.com/yast-ai/expo-sample-project.git /tmp/repo
git -C /tmp/repo fetch --depth 1 origin ${sourceSha}
git -C /tmp/repo checkout --detach ${sourceSha}
bash /tmp/experiment-run.sh ${folder} ${workers} ${heap} ${warmWorkers} ${warmHeap}
`;
  job.sandboxRequestedAt=Date.now();save();
  const result = await api.create({ idempotencyKey: `expo-benchmark-${jobId}-${job.createdAt}`, createSandboxRequest: { type:'large',ttlSeconds:3600,noEnv:true,snapshots:false,from:'android-build-tools',env:{EXPO_TOKEN:expoToken,...uploads},setupScript } });
  job.sandboxId = result.sandbox.id; save(); console.log(`${jobId}: ${job.sandboxId}`);
  let transient = 0;
  while (Date.now() - job.createdAt < 3_300_000) {
    await sleep(15000);
    let sandbox; try { sandbox = (await api.get({sandboxId:job.sandboxId})).sandbox; transient=0; } catch(e) { if (e.response?.status >= 500 && transient++ < 3) continue; throw e; }
    job.boatState = sandbox.state; job.setupStatus = sandbox.setupStatus;
    if (!['ready','running','idle'].includes(sandbox.state)) { if (['error','archived','cancelled'].includes(sandbox.state)) throw Error(sandbox.error || sandbox.state); save(); continue; }
    const text = await command(`node -e 'const fs=require("fs"),p="/home/user/benchmark/",r={};for(const n of ["phase","metrics.ndjson","cold.start","cold.end","cold.status","warm.start","warm.end","warm.status","warm2.start","warm2.end","warm2.status","cold.trigger","warm.trigger","warm2.trigger","cold.receipt","warm.receipt","warm2.receipt"]){try{r[n]=fs.readFileSync(p+n,"utf8")}catch{}}try{r.log=fs.readFileSync("/home/user/build.log","utf8").slice(-4000)}catch{};console.log(JSON.stringify(r))'`);
    const data = JSON.parse(text), samples = (data['metrics.ndjson']||'').trim().split('\n').filter(Boolean).map(s=>JSON.parse(s));
    fs.writeFileSync(path.join(output,'metrics.ndjson'),data['metrics.ndjson']||'');
    job.status = 'in progress'; job.phase = (data.phase||'setup').trim(); job.logTail = safe(data.log||'');
    for (const run of job.runs) {
      const start = Number(data[`${run.cache}.start`]), end = Number(data[`${run.cache}.end`]);
      if (!start) continue;
      run.triggeredAt=run.cache==='cold'?job.createdAt:Number(data[`${run.cache}.trigger`]||start);run.buildStartedAt=start;if(end)run.buildCompletedAt=end;
      run.provisionSetupSeconds=(start-run.triggeredAt)/1000;
      Object.assign(run, summarize(samples,start,end||Date.now()));
      run.status = end ? 'publishing' : 'in progress';
      if (end && data[`${run.cache}.receipt`] && !run.artifactUrl) Object.assign(run, await transfer(run.cache,data));
      if(run.artifactReadyAt){run.status='success';run.endToEndSeconds=(run.artifactReadyAt-run.triggeredAt)/1000;run.pollingAndPublishSeconds=(run.artifactReadyAt-end)/1000-run.artifactUploadSeconds;}
    }
    save();
    if (/\bERROR\s*$/.test(data.log||'') || sandbox.setupStatus==='failed') throw Error(sandbox.setupError || 'Build failed; inspect timestamped log');
    if (job.runs.every(r=>r.status==='success')) { job.status='success'; break; }
  }
  if (job.status !== 'success') throw Error('55-minute benchmark deadline');
} catch(e) {
  job.status='error'; job.error=safe(e.message||e);
  if (e.response) job.error += ` HTTP ${e.response.status}: ${safe((await e.response.clone().text()).slice(0,2000))}`;
  for (const run of job.runs) if(run.status!=='success')run.status='error';
  console.error(jobId,job.error);
} finally {
  if(job.sandboxId) {
    try {
      const log = await command('cat /home/user/build.log',20);fs.writeFileSync(path.join(output,'build.log'),safe(log));
    } catch {}
    for(let i=0;i<4;i++){try{await api.stop({sandboxId:job.sandboxId});job.stopped=true;break;}catch(e){job.stopError=safe(e.message);await sleep(3000);}}
  }
  job.finishedAt=Date.now();save(); console.log(`${jobId}: ${job.status}, stopped=${job.stopped}`);
}
