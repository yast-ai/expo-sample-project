import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {createRequire} from 'node:module';
const {BoatApi,Configuration}=createRequire(import.meta.url)('../backend/node_modules/@boatdev/sdk/dist/index.js');
import { summarize,parseSamples } from './metrics.mjs';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repo=fs.existsSync(path.join(root,'expo-sample-project/package.json'))?path.join(root,'expo-sample-project'):root;
const matrix=JSON.parse(fs.readFileSync(path.join(root,'benchmark/v2-strategies.json')));
const strategy=matrix.strategies.find(s=>s.id===process.argv[2]);if(!strategy)throw Error('Unknown V2 strategy');
const {workers,heap}=strategy,warmWorkers=strategy.warmWorkers||workers,warmHeap=strategy.warmHeap||heap;
const project='native-heavy',config=`${strategy.id} · ${strategy.name}`,profile='preview',lane='v2',jobId=process.env.RESUME_BENCHMARK_JOB||`v2-${strategy.id}-${matrix.startedAt}${process.env.V2_ATTEMPT?'-retry'+process.env.V2_ATTEMPT:''}`;
const sourceSha = matrix.sourceSha;
const output = path.join(root, 'verification/benchmarks', jobId), jobs = path.join(root, 'benchmark/jobs');
fs.mkdirSync(output, { recursive: true }); fs.mkdirSync(jobs, { recursive: true });
const boatKey = fs.readFileSync('/private/tmp/expo-sample-boat-key', 'utf8').trim();
const expoToken = fs.readFileSync('/private/tmp/expo-build-token', 'utf8').trim();
const api = new BoatApi(new Configuration({ accessToken: boatKey }));
const convex=(fn,args)=>JSON.parse(execFileSync('bunx',['convex','run',fn,JSON.stringify(args)],{cwd:path.join(repo,'backend'),encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const job=process.env.RESUME_BENCHMARK_JOB?JSON.parse(fs.readFileSync(path.join(jobs,jobId+'.json'),'utf8')):{id:jobId,benchmarkVersion:2,strategyId:strategy.id,strategy,project,profile,lane,config,workers,heap,warmWorkers,warmHeap,sourceSha,cacheMode:'Fresh v5 VM; public Maven prewarmed; empty project caches; fresh EAS directory; persistent Gradle/compiler caches',status:'starting',createdAt:Date.now(),runs:['cold','warm'].map(cache=>({project,profile,lane,config,benchmarkVersion:2,strategyId:strategy.id,workers:cache==='cold'?workers:warmWorkers,gradleHeapMiB:cache==='cold'?heap:warmHeap,kotlinStrategy:'in-process',kotlinHeapMiB:null,architectures:['armeabi-v7a','arm64-v8a','x86','x86_64'],provisioningIncluded:true,ccache:strategy.ccache,metroWorkers:strategy.metroWorkers,ninjaJobs:strategy.ninjaJobs||null,docker:Boolean(strategy.docker),cache,sourceSha,status:'queued'}))};

const safe = s => [expoToken,boatKey].flatMap(v=>[v,Buffer.from(v).toString('base64'),Buffer.from(v).toString('base64url')]).reduce((text,v)=>text.replaceAll(v,'[REDACTED]'),String(s));
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
 let completed;for(let attempt=0;;attempt++){try{completed=convex('artifacts:completeUpload',{key});break;}catch(e){if(attempt>=3)throw e;await sleep(2000*2**attempt);}}
 if(completed.size!==receipt.bytes)throw Error('Artifact size did not match build receipt');const ready=Date.now();
 return {artifactMiB:completed.size/2**20,artifactSha256:receipt.sha256,artifactVerified:false,artifactSizeVerified:completed.size===receipt.bytes,storageKey:key,artifactUrl:`https://quaint-magpie-201.convex.site/benchmark-artifact?key=${encodeURIComponent(key)}`,artifactUploadSeconds:(receipt.uploadEnd-receipt.uploadStart)/1000,uploadCompletedAt:receipt.uploadEnd,artifactReadyAt:ready};
}

save();
try {
  if(!process.env.RESUME_BENCHMARK_JOB){
  const folder='/tmp/v2-repo/variants/native-heavy';
  const runner=fs.readFileSync(path.join(root,'benchmark/v2-run.sh'),'utf8'),sampler=fs.readFileSync(path.join(repo,'benchmark/sample.mjs'),'utf8'),telemetry=fs.readFileSync(path.join(root,'research/gradle-task-telemetry.init.gradle'),'utf8');
  const uploads={};for(const cache of ['cold','warm'])uploads[`V2_${cache.toUpperCase()}_UPLOAD_URL`]=convex('artifacts:benchmarkUpload',{key:`benchmarks/${jobId}/${cache}.apk`}).url;
  const encode=s=>Buffer.from(s).toString('base64');
  const setupScript=`#!/usr/bin/env bash
set -Eeuo pipefail
exec > >(TZ=UTC awk '{ print strftime("[%Y-%m-%dT%H:%M:%SZ]"), $0; fflush() }' >> /home/user/v2-build.log) 2>&1
trap 'rc=$?; if [ "$rc" -eq 0 ]; then echo SUCCESS; else echo ERROR; fi' EXIT
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ANDROID_HOME=/home/user/android-sdk ANDROID_SDK_ROOT=/home/user/android-sdk PATH="/usr/local/bin:/home/user/.bun/bin:/home/user/android-sdk/cmdline-tools/22.0/bin:/home/user/android-sdk/platform-tools:$PATH"
node -e 'require("fs").writeFileSync("/tmp/v2-run.sh",Buffer.from("${encode(runner)}","base64"));require("fs").writeFileSync("/tmp/v2-sample.mjs",Buffer.from("${encode(sampler)}","base64"));require("fs").writeFileSync("/tmp/v2-task.gradle",Buffer.from("${encode(telemetry)}","base64"))'
git clone --depth 1 https://github.com/yast-ai/expo-sample-project.git /tmp/v2-repo
git -C /tmp/v2-repo fetch --depth 1 origin ${sourceSha}
git -C /tmp/v2-repo checkout --detach ${sourceSha}
if [ "${strategy.docker?'yes':'no'}" = yes ]; then
  sudo systemctl start docker 2>/dev/null || sudo service docker start 2>/dev/null || (sudo dockerd > /tmp/v2-dockerd.log 2>&1 &)
  for attempt in {1..30}; do sudo docker info >/dev/null 2>&1 && break; sleep 1; done
  sudo docker image inspect android-toolchain:node24-bun1.4.2 >/dev/null 2>&1 || sudo docker load -i /opt/android-toolchain/android-image.tar
  sudo docker run --rm --cpus=8 --user 1000:1000 -e HOME=/home/user -e EXPO_TOKEN -e V2_STRATEGY_B64 -e V2_COLD_UPLOAD_URL -e V2_WARM_UPLOAD_URL -e JAVA_HOME -e ANDROID_HOME -e ANDROID_SDK_ROOT -v /home/user:/home/user -v /tmp:/tmp -v /opt/eas22:/opt/eas22:ro android-toolchain:node24-bun1.4.2 bash /tmp/v2-run.sh ${folder}
else
  bash /tmp/v2-run.sh ${folder}
fi
`;
  job.sandboxRequestedAt=Date.now();job.provisioningIncluded=true;job.ccache=strategy.ccache;job.kotlinStrategy='in-process';job.metaspaceMiB=2048;job.metroWorkers=strategy.metroWorkers;job.nodeHeapMiB=2048;save();
  const result=await api.create({idempotencyKey:`expo-${jobId}`,createSandboxRequest:{type:'large',ttlSeconds:2400,noEnv:true,snapshots:false,from:process.env.V2_TEMPLATE||matrix.template,env:{EXPO_TOKEN:expoToken,V2_STRATEGY_B64:encode(JSON.stringify(strategy)),...uploads},setupScript}});
  job.sandboxId=result.sandbox.id;job.provisionReturnedAt=Date.now();save();console.log(`${jobId}: ${job.sandboxId}, launched`);
  } else console.log(`${jobId}: resumed monitor on ${job.sandboxId}`);
  let transient = 0;
  while (Date.now() - job.createdAt < 1_500_000) {
    await sleep(15000);
    let sandbox; try { sandbox = (await api.get({sandboxId:job.sandboxId})).sandbox; transient=0; } catch(e) { if (e.response?.status >= 500 && transient++ < 3) continue; throw e; }
    job.boatState = sandbox.state; job.setupStatus = sandbox.setupStatus;
    if (!['ready','running','idle'].includes(sandbox.state)) { if (['error','archived','cancelled'].includes(sandbox.state)) throw Error(sandbox.error || sandbox.state); save(); continue; }
    const manifest=JSON.parse(await command(`node -e 'const fs=require("fs"),p="/home/user/benchmark-v2/",r={names:[]};try{r.names=fs.readdirSync(p).filter(n=>/^(phase|metrics\\.ndjson|tasks-(cold|warm)\\.ndjson|ccache-(cold|warm)\\.txt|launchers-(cold|warm)\\.txt|(cold|warm)\\.(start|end|status|trigger|receipt)|gc-(cold|warm).*\\.log)$/.test(n));}catch{}try{r.log=fs.readFileSync("/home/user/v2-build.log","utf8").slice(-4000)}catch{}console.log(JSON.stringify(r))'`));
    const data={log:manifest.log||''};
    const captures=await Promise.allSettled(manifest.names.map(async name=>{const r=await api.readFile({sandboxId:job.sandboxId,path:'/home/user/benchmark-v2/'+name,encoding:'utf8'});if(Buffer.byteLength(r.content)!==r.size)throw Error('Incomplete '+name);return [name,r.content];}));
    for(let i=0;i<captures.length;i++){const r=captures[i];if(r.status==='fulfilled')data[r.value[0]]=r.value[1];else job.captureWarning=safe('Retry '+manifest.names[i]+': '+r.reason.name);}
    try {const r=await api.readFile({sandboxId:job.sandboxId,path:'/home/user/v2-build.log',encoding:'utf8'});if(Buffer.byteLength(r.content)===r.size)fs.writeFileSync(path.join(output,'build.log'),safe(r.content));} catch {}
    const samples=parseSamples(data['metrics.ndjson']||'');
    if(data['metrics.ndjson'])fs.writeFileSync(path.join(output,'metrics.ndjson'),data['metrics.ndjson']);
    for(const [name,content] of Object.entries(data))if(/^(tasks-|ccache-|launchers-|gc-)/.test(name))fs.writeFileSync(path.join(output,name),safe(content));
    job.status = 'in progress'; job.phase = (data.phase||'setup').trim(); job.logTail = safe(data.log||'');
    for (const run of job.runs) {
      const start = Number(data[`${run.cache}.start`]), end = Number(data[`${run.cache}.end`]);
      if (!start) continue;
      run.triggeredAt=run.cache==='cold'?job.createdAt:Number(data[`${run.cache}.trigger`]||start);run.buildStartedAt=start;if(end)run.buildCompletedAt=end;
      run.provisionSetupSeconds=run.cache==='cold'?(start-run.triggeredAt)/1000:0;run.setupSeconds=run.cache==='cold'?null:(start-run.triggeredAt)/1000;
      Object.assign(run, summarize(samples,start,end||Date.now()));
      run.status = end ? 'publishing' : 'in progress';
      if (end && data[`${run.cache}.receipt`] && !run.artifactUrl) {try{Object.assign(run, await transfer(run.cache,data));delete run.publishError;}catch(e){run.publishError=safe(e.message||e);console.error(`${jobId}: publication will retry (${run.cache})`);}}
      if(run.artifactReadyAt){run.status='success';run.endToEndSeconds=(run.artifactReadyAt-run.triggeredAt)/1000;run.pollingAndPublishSeconds=(run.artifactReadyAt-end)/1000-run.artifactUploadSeconds;}
    }
    save();
    if (data['cold.status']?.trim()==='ERROR'||data['warm.status']?.trim()==='ERROR'|| /\bERROR\s*$/.test(data.log||'') || sandbox.setupStatus==='failed') throw Error(sandbox.setupError || 'Build failed; inspect timestamped log');
    if (job.runs.every(r=>r.status==='success')) { job.status='success'; break; }
  }
  if (job.status !== 'success') throw Error('25-minute V2 lane deadline');
} catch(e) {
  job.status='error'; job.error=safe(e.message||e);
  if (e.response) job.error += ` HTTP ${e.response.status}: ${safe((await e.response.clone().text()).slice(0,2000))}`;
  for (const run of job.runs) if(run.status!=='success'){run.status=run.buildStartedAt?'error':'skipped';run.error=job.error;}
  console.error(jobId,job.error);
} finally {
  if(job.sandboxId) {
    try {
      const r=await api.readFile({sandboxId:job.sandboxId,path:'/home/user/v2-build.log',encoding:'utf8'});if(Buffer.byteLength(r.content)!==r.size)throw Error('Incomplete build log');fs.writeFileSync(path.join(output,'build.log'),safe(r.content));
    } catch {}
    try {const gc=JSON.parse(await command(`node -e 'const fs=require("fs"),p="/home/user/benchmark-v2",a=[];for(const d of ["gc-cold","gc-warm"]){try{for(const n of fs.readdirSync(p+"/"+d))if(n.endsWith(".log"))a.push(d+"/"+n)}catch{}}console.log(JSON.stringify(a))'`));for(const n of gc){const r=await api.readFile({sandboxId:job.sandboxId,path:'/home/user/benchmark-v2/'+n,encoding:'utf8'});if(Buffer.byteLength(r.content)===r.size){fs.mkdirSync(path.dirname(path.join(output,n)),{recursive:true});fs.writeFileSync(path.join(output,n),safe(r.content));}}} catch(e){job.gcCaptureError=safe(e.message);}
    for(let i=0;i<4;i++){try{await api.stop({sandboxId:job.sandboxId});job.stopped=true;break;}catch(e){job.stopError=safe(e.message);await sleep(3000);}}
  }
  job.finishedAt=Date.now();save(); console.log(`${jobId}: ${job.status}, stopped=${job.stopped}`);
}
