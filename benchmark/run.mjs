import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { BoatApi, Configuration } from '../backend/node_modules/@boatdev/sdk/dist/esm/index.js';
import { summarize } from './metrics.mjs';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [project = 'control', profile = 'preview', lane = 'baseline', workerArg = '6'] = process.argv.slice(2);
const workers = Number(workerArg), jobId = `${project}-${profile}-${lane}-${Date.now()}`;
const sourceSha = execFileSync('git',['-C',path.join(root,'expo-sample-project'),'rev-parse','origin/main'],{encoding:'utf8'}).trim();
const output = path.join(root, 'verification/benchmarks', jobId), jobs = path.join(root, 'benchmark/jobs');
fs.mkdirSync(output, { recursive: true }); fs.mkdirSync(jobs, { recursive: true });
const boatKey = fs.readFileSync('/private/tmp/expo-sample-boat-key', 'utf8').trim();
const expoToken = fs.readFileSync('/private/tmp/expo-build-token', 'utf8').trim();
const api = new BoatApi(new Configuration({ accessToken: boatKey }));
const convex=(fn,args)=>JSON.parse(execFileSync('bunx',['convex','run',fn,JSON.stringify(args)],{cwd:path.join(root,'expo-sample-project/backend'),encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const job = { id: jobId, project, profile, lane, workers, sourceSha, cacheMode:'Same VM; Bun, npm and Gradle caches; fresh EAS working directory', status: 'starting', createdAt: Date.now(), runs: ['cold','warm'].map(cache => ({project,profile,lane,workers,cache,sourceSha,status:'queued'})) };
const safe = s => String(s).replaceAll(expoToken, '[EXPO_TOKEN]').replaceAll(boatKey, '[BOAT_API_KEY]');
const save = () => fs.writeFileSync(path.join(jobs, jobId + '.json'), JSON.stringify(job, null, 2));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function command(command, timeoutSeconds = 20) {
  for (let attempt = 0; ; attempt++) {
    try { const r = await api.command({ sandboxId: job.sandboxId, commandRequest: {command,timeoutSeconds} }); if (!('stdout' in r) || r.exitCode !== 0) throw Error(safe(JSON.stringify(r))); return r.stdout || ''; }
    catch(e) { if (attempt >= 3 || (e.response && e.response.status < 500)) throw e; await sleep(3000); }
  }
}
async function transfer(cache) {
  const ext = profile === 'preview' ? 'apk' : 'aab', source = `/home/user/benchmark/${cache}.${ext}`;
  const uploadStartedAt=Date.now();
  await command(`curl --fail --silent --show-error --max-time 115 --upload-file ${source} "$BENCHMARK_UPLOAD_${cache.toUpperCase()}_URL"`,120);
  const uploadCompletedAt=Date.now(),storageKey=`benchmarks/${jobId}/${cache}.${ext}`,completed=convex('artifacts:completeUpload',{key:storageKey}),artifactUrl=`https://quaint-magpie-201.convex.site/benchmark-artifact?key=${encodeURIComponent(storageKey)}`,artifactReadyAt=Date.now();
  const checksum = (await command(`sha256sum ${source}`)).split(/\s+/)[0];
  const listing = await command(`split -b 40m -d ${source} /home/user/benchmark/${cache}.part. && ls /home/user/benchmark/${cache}.part.*`, 30);
  const parts = listing.trim().split('\n').filter(p => /^\/home\/user\/benchmark\/(cold|warm)\.part\.\d{2}$/.test(p));
  if (!parts.length) throw Error('No artifact transfer parts');
  const target = path.join(output, `${cache}.${ext}`), fd = fs.openSync(target, 'w');
  try { for (const p of parts) { const blob = await api.artifact({ sandboxId: job.sandboxId, path: p.slice('/home/user/'.length) }); fs.writeSync(fd, Buffer.from(await blob.arrayBuffer())); } } finally { fs.closeSync(fd); }
  const localChecksum=createHash('sha256').update(fs.readFileSync(target)).digest('hex');
  if(localChecksum!==checksum)throw Error('Artifact checksum mismatch');
  await command(`rm /home/user/benchmark/${cache}.part.*`);
  return { artifactMiB: fs.statSync(target).size / 2 ** 20, artifactSha256:checksum,artifactVerified:true, storageKey,artifactUrl,artifactUploadSeconds:(uploadCompletedAt-uploadStartedAt)/1000,artifactReadyAt,localArtifactReadyAt:Date.now() };
}
save();
try {
  const folder = project === 'control' ? '/tmp/repo' : `/tmp/repo/variants/${project}`;
  const setupScript = `#!/usr/bin/env bash\nset -Eeuo pipefail\nexec > >(TZ=UTC awk '{ print strftime("[%Y-%m-%dT%H:%M:%SZ]"), $0; fflush() }' >> /home/user/build.log) 2>&1\ntrap 'rc=$?; if [ "$rc" -eq 0 ]; then echo SUCCESS; else echo ERROR; fi' EXIT\nexport EXPO_TOKEN JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ANDROID_HOME=/home/user/android-sdk ANDROID_SDK_ROOT=/home/user/android-sdk PATH="/home/user/.bun/bin:/home/user/android-sdk/cmdline-tools/latest/bin:/home/user/android-sdk/platform-tools:$PATH" BUN_INSTALL_CACHE_DIR=/tmp/bun-cache\ngit clone --depth 1 https://github.com/yast-ai/expo-sample-project.git /tmp/repo\ngit -C /tmp/repo fetch --depth 1 origin ${sourceSha}\ngit -C /tmp/repo checkout --detach ${sourceSha}\nbash /tmp/repo/benchmark/run.sh ${folder} ${profile} ${workers}\n`;
  const ext=profile==='preview'?'apk':'aab';
  const coldUpload=convex('artifacts:benchmarkUpload',{key:`benchmarks/${jobId}/cold.${ext}`}).url,warmUpload=convex('artifacts:benchmarkUpload',{key:`benchmarks/${jobId}/warm.${ext}`}).url;
  job.sandboxRequestedAt=Date.now();save();
  const result = await api.create({ idempotencyKey: `expo-benchmark-${jobId}-${job.createdAt}`, createSandboxRequest: { type:'large',ttlSeconds:3600,noEnv:true,snapshots:false,from:'android-build-tools',env:{EXPO_TOKEN:expoToken,BENCHMARK_UPLOAD_COLD_URL:coldUpload,BENCHMARK_UPLOAD_WARM_URL:warmUpload},setupScript } });
  job.sandboxId = result.sandbox.id; save(); console.log(`${jobId}: ${job.sandboxId}`);
  let transient = 0;
  while (Date.now() - job.createdAt < 3_300_000) {
    await sleep(15000);
    let sandbox; try { sandbox = (await api.get({sandboxId:job.sandboxId})).sandbox; transient=0; } catch(e) { if (e.response?.status >= 500 && transient++ < 3) continue; throw e; }
    job.boatState = sandbox.state; job.setupStatus = sandbox.setupStatus;
    if (!['ready','running','idle'].includes(sandbox.state)) { if (['error','archived','cancelled'].includes(sandbox.state)) throw Error(sandbox.error || sandbox.state); save(); continue; }
    const text = await command(`node -e 'const fs=require("fs"),p="/home/user/benchmark/",r={};for(const n of ["phase","metrics.ndjson","cold.start","cold.end","cold.status","warm.start","warm.end","warm.status"]){try{r[n]=fs.readFileSync(p+n,"utf8")}catch{}}try{r.log=fs.readFileSync("/home/user/build.log","utf8").slice(-4000)}catch{};console.log(JSON.stringify(r))'`);
    const data = JSON.parse(text), samples = (data['metrics.ndjson']||'').trim().split('\n').filter(Boolean).map(s=>JSON.parse(s));
    fs.writeFileSync(path.join(output,'metrics.ndjson'),data['metrics.ndjson']||'');
    job.status = 'in progress'; job.phase = (data.phase||'setup').trim(); job.logTail = safe(data.log||'');
    for (const run of job.runs) {
      const start = Number(data[`${run.cache}.start`]), end = Number(data[`${run.cache}.end`]);
      if (!start) continue;
      run.triggeredAt=run.cache==='cold'?job.createdAt:start;run.buildStartedAt=start;if(end)run.buildCompletedAt=end;
      run.provisionSetupSeconds=run.cache==='cold'?(start-job.createdAt)/1000:0;
      Object.assign(run, summarize(samples,start,end||Date.now()));
      run.status = end ? 'success' : 'in progress';
      if (end && !run.artifactUrl) Object.assign(run, await transfer(run.cache));
      if(run.artifactReadyAt){run.endToEndSeconds=(run.artifactReadyAt-run.triggeredAt)/1000;run.pollingAndPublishSeconds=(run.artifactReadyAt-end)/1000-run.artifactUploadSeconds;}
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
