import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {summarize,parseSamples} from './metrics.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repo=fs.existsSync(path.join(root,'expo-sample-project/package.json'))?path.join(root,'expo-sample-project'):root;
const {BoatApi,Configuration}=createRequire(import.meta.url)('../backend/node_modules/@boatdev/sdk/dist/index.js');
const matrix=JSON.parse(fs.readFileSync(path.resolve(root,process.env.COLD_MATRIX||'benchmark/cold-matrix.json')));
const [project,strategyId,replica='1']=process.argv.slice(2),strategy=matrix.strategies.find(s=>s.id===strategyId);
if(!['native-heavy','disposabl'].includes(project)||!strategy||!/^\d+$/.test(replica))throw Error('Usage cold-lane.mjs native-heavy|disposabl A|B|C|D replica');
const privateApp=project==='disposabl',stamp=process.env.COLD_ROUND||'1791418500000',id=`cold-${project}-${strategyId}-${replica}-${stamp}${process.env.COLD_ATTEMPT?'-retry'+process.env.COLD_ATTEMPT:''}`;
const output=path.join(root,'verification/benchmarks',id),file=path.join(root,'benchmark/jobs',id+'.json');fs.mkdirSync(output,{recursive:true});
const key=fs.readFileSync('/private/tmp/expo-sample-boat-key','utf8').trim(),token=fs.readFileSync('/private/tmp/expo-build-token','utf8').trim();
const api=new BoatApi(new Configuration({accessToken:key}));
const secrets=[key,token,...['/private/tmp/expo-build-previous-token'].filter(fs.existsSync).map(p=>fs.readFileSync(p,'utf8').trim())].flatMap(v=>[v,Buffer.from(v).toString('base64'),Buffer.from(v).toString('base64url')]);
const safe=v=>secrets.reduce((s,v)=>s.replaceAll(v,'[REDACTED]'),String(v));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const sourceSha=privateApp?matrix.privateSourceSha:matrix.publicSourceSha;
const run={project,profile:'preview',cache:'cold',benchmarkVersion:3,strategyId,strategy,replica:Number(replica),sourceSha,machineType:strategy.machineType||'large',round:stamp,architectures:['armeabi-v7a','arm64-v8a','x86','x86_64'],workers:strategy.workers,gradleHeapMiB:strategy.heapMiB,metroWorkers:strategy.metroWorkers||4,kotlinStrategy:'in-process',ccache:false,pch:strategy.pch,ninjaJobs:strategy.ninjaJobs,docker:false,status:'queued'};
const job=process.env.COLD_RESUME?JSON.parse(fs.readFileSync(file)):{id,project,private:privateApp,profile:'preview',benchmarkVersion:3,strategyId,strategy,sourceSha,lane:'cold',config:`${strategyId} · ${strategy.name} · R${replica}`,workers:strategy.workers,heap:strategy.heapMiB,machineType:strategy.machineType||'large',round:stamp,status:'starting',createdAt:Date.now(),runs:[run]};
const save=()=>fs.writeFileSync(file,JSON.stringify(job,null,2));
async function retry(fn){for(let i=0;;i++){try{return await fn();}catch(e){if(i>=3||(e.response&&e.response.status<500&&e.response.status!==429))throw e;await sleep(1500*2**i);}}}
async function command(command,timeoutSeconds=60){const r=await retry(()=>api.command({sandboxId:job.sandboxId,commandRequest:{command,timeoutSeconds}}));if(r.exitCode!==0)throw Error(safe(r.stderr||r.stdout||`VM command ${r.exitCode}`));return r.stdout||'';}
async function write(remote,content,encoding='utf8'){const data=encoding==='base64'?content:Buffer.from(content).toString('base64');if(!/^\/(tmp|home\/user)\/[a-zA-Z0-9._/-]+$/.test(remote))throw Error('Invalid VM file path');await command(`: > ${remote}.b64`);for(let off=0;off<data.length;off+=20000)await command(`printf '%s' '${data.slice(off,off+20000)}' >> ${remote}.b64`);await command(`base64 -d ${remote}.b64 > ${remote}\nrm ${remote}.b64`);}
async function read(remote,encoding='utf8'){const r=await retry(()=>api.readFile({sandboxId:job.sandboxId,path:remote,encoding}));if(encoding==='utf8'&&Buffer.byteLength(r.content)!==r.size)throw Error('Incomplete '+remote);return r.content;}
async function privateTransfer(){
 const zip=fs.readFileSync('/private/tmp/disposabl-private-preview-3f9f1b0.zip'),hash=createHash('sha256').update(zip).digest('hex');
 // Direct authenticated SCP to the explicitly authorized VM; never public storage.
 execFileSync('boat',['scp','--no-update','/private/tmp/disposabl-private-preview-3f9f1b0.zip',`${job.sandboxId}:/tmp/private-source.zip`],{stdio:['ignore','pipe','pipe'],timeout:120000});
 await command(`[ "$(sha256sum /tmp/private-source.zip | cut -d ' ' -f1)" = '${hash}' ]\nmkdir -p /tmp/cold-source\nunzip -q /tmp/private-source.zip -d /tmp/cold-source\ncd /tmp/cold-source\ngit init -q\ngit config user.email benchmark@local\ngit config user.name benchmark\ngit add -A\ngit commit -qm private-preview\ntest -s apps/mobile/google-services.json`,120);
 job.sourceArchiveSha256=hash;job.sourceTransferred=true;save();
}
async function capture(){
 const manifest=JSON.parse(await command(`node -e 'const fs=require("fs"),p="/home/user/benchmark-cold";let names=[];try{names=fs.readdirSync(p).filter(n=>/^((build|setup)\\.log|metrics\\.ndjson|tasks-cold\\.ndjson|cold\\.(start|end|status|receipt)|hardware\\.json|native-evidence\\.(json|txt)|native-files\\.txt|apk-files\\.txt|processes\\.ndjson|.*gc.*\\.log)$/.test(n))}catch{};console.log(JSON.stringify(names))'`));
 const data={};const captures=await Promise.allSettled(manifest.map(async n=>[n,await read('/home/user/benchmark-cold/'+n)]));
 for(const r of captures)if(r.status==='fulfilled'){const[n,v]=r.value;data[n]=v;fs.writeFileSync(path.join(output,n),safe(v));}
 const current=job.runs[0],start=Number(data['cold.start']),end=Number(data['cold.end']);
 if(data['hardware.json']){try{job.hardware=JSON.parse(data['hardware.json']);current.hardware=job.hardware;}catch{}}
 if(start){current.buildStartedAt=start;current.triggeredAt=job.createdAt;current.provisionSetupSeconds=(start-job.createdAt)/1000;Object.assign(current,summarize(parseSamples(data['metrics.ndjson']||''),start,end||Date.now()));current.status=end?'publishing':'in progress';job.status=current.status;}
 if(end){current.buildCompletedAt=end;current.durationSeconds=(end-start)/1000;}
 if(data['cold.receipt']){const receipt=JSON.parse(data['cold.receipt']);job.receipt=receipt;Object.assign(current,{artifactBytes:receipt.bytes,artifactMiB:receipt.bytes/2**20,artifactSha256:receipt.sha256,actualArchitectures:receipt.architectures,pchVerified:receipt.pchVerified});}
 job.logTail=privateApp?undefined:safe((data['build.log']||'').slice(-1500));save();return data;
}
async function retainEvidence(){
 await command('tar --exclude=cold.apk -czf /tmp/cold-evidence.tar.gz -C /home/user/benchmark-cold .',120);
 try{execFileSync('boat',['scp','--no-update',`${job.sandboxId}:/tmp/cold-evidence.tar.gz`,path.join(output,'evidence.tar.gz')],{stdio:['ignore','pipe','pipe'],timeout:120000});job.evidenceArchived=true;}catch{job.evidenceArchiveWarning='SCP unavailable; API text capture retained';}
 const earlier=fs.readdirSync(path.join(root,'benchmark/jobs')).filter(n=>n.startsWith('cold-')&&n.endsWith('.json')).map(n=>JSON.parse(fs.readFileSync(path.join(root,'benchmark/jobs',n)))).filter(j=>j.project===project&&j.status==='success').map(j=>j.runs[0].durationSeconds);
 if(strategy.machineType==='xlarge'||!earlier.length||job.runs[0].durationSeconds<Math.min(...earlier)){
  try{const apk=path.join(output,'cold.apk');execFileSync('boat',['scp','--no-update',`${job.sandboxId}:/home/user/benchmark-cold/cold.apk`,apk],{stdio:['ignore','pipe','pipe'],timeout:120000});const bytes=fs.readFileSync(apk);if(bytes.length!==job.receipt.bytes||createHash('sha256').update(bytes).digest('hex')!==job.receipt.sha256)throw Error('checksum');job.localApkRetained=true;}catch{job.apkCaptureWarning='APK download unavailable; VM ABI receipt retained';}
 }
 save();
}
async function publicArtifact(){
 const backend=path.join(repo,'backend'),key=`benchmarks/${id}/cold.apk`;
 const convex=(fn,args)=>JSON.parse(execFileSync('bunx',['convex','run',fn,JSON.stringify(args)],{cwd:backend,encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 const url=convex('artifacts:benchmarkUpload',{key}).url,started=Date.now();
 await write('/tmp/cold-upload-url',url);await command('curl --fail --silent --show-error --max-time 115 --upload-file /home/user/benchmark-cold/cold.apk "$(cat /tmp/cold-upload-url)"\nrm /tmp/cold-upload-url',120);
 const receipt=convex('artifacts:completeUpload',{key});if(receipt.size!==job.receipt.bytes)throw Error('Artifact receipt size mismatch');
 Object.assign(job.runs[0],{artifactUrl:`https://quaint-magpie-201.convex.site/benchmark-artifact?key=${encodeURIComponent(key)}`,storageKey:key,artifactSizeVerified:true,artifactUploadSeconds:(Date.now()-started)/1000,artifactReadyAt:Date.now()});
}
save();
try{
 if(!process.env.COLD_RESUME){
  const budget=fs.readdirSync(path.join(root,'benchmark/jobs')).filter(n=>n.startsWith('cold-')&&n.endsWith('.json')).map(n=>JSON.parse(fs.readFileSync(path.join(root,'benchmark/jobs',n)))).filter(j=>j.sandboxId&&(!process.env.COLD_MATRIX||j.round===stamp)).length;if(budget>=matrix.sandboxAllowance)throw Error('Cold round VM budget exhausted');
  const setupScript=`#!/usr/bin/env bash\nset -Eeuo pipefail\nmkdir -p /home/user/benchmark-cold\nexport JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ANDROID_HOME=/home/user/android-sdk ANDROID_SDK_ROOT=/home/user/android-sdk\nexport PATH="/usr/local/bin:/home/user/.bun/bin:/home/user/android-sdk/cmdline-tools/22.0/bin:/home/user/android-sdk/platform-tools:$PATH"\nfor attempt in {1..300}; do test -f /tmp/cold-launch.sh && exec bash /tmp/cold-launch.sh; sleep 1; done\necho ERROR > /home/user/benchmark-cold/cold.status\nexit 70\n`;
  const created=await retry(()=>api.create({idempotencyKey:id,createSandboxRequest:{type:strategy.machineType||'large',ttlSeconds:2100,noEnv:true,snapshots:false,from:matrix.template,env:{EXPO_TOKEN:token,COLD_STRATEGY_B64:Buffer.from(JSON.stringify(strategy)).toString('base64')},setupScript}}));job.sandboxId=created.sandbox.id;save();console.log(`${id}: ${job.sandboxId}`);
  for(let i=0;i<60;i++){const s=(await retry(()=>api.get({sandboxId:job.sandboxId}))).sandbox;if(['ready','running','idle'].includes(s.state))break;if(['error','archived','cancelled'].includes(s.state))throw Error('Provision failed '+s.state);await sleep(2000);}
  const hw=JSON.parse(await command(`python3 - <<'PY'\nimport json,os,subprocess\nprint(json.dumps({'lscpu':json.loads(subprocess.check_output(['lscpu','-J'])),'kvm':os.path.exists('/dev/kvm'),'cpus':os.cpu_count(),'memoryTotalKiB':int(open('/proc/meminfo').read().split('MemTotal:')[1].split()[0]),'memoryMax':open('/sys/fs/cgroup/memory.max').read().strip() if os.path.exists('/sys/fs/cgroup/memory.max') else None,'cpuMax':open('/sys/fs/cgroup/cpu.max').read().strip() if os.path.exists('/sys/fs/cgroup/cpu.max') else None}))\nPY`));job.hardwarePreflight=hw;save();
  const quota=hw.cpuMax?.split(/\s+/),effective=quota?.[0]&&quota[0]!=='max'?Number(quota[0])/Number(quota[1]):hw.cpus,expected=strategy.machineType==='xlarge'?16:8;const memoryLimit=hw.memoryMax&&hw.memoryMax!=='max'?Math.min(hw.memoryTotalKiB*1024,Number(hw.memoryMax)):hw.memoryTotalKiB*1024;if(effective<expected||memoryLimit<(strategy.machineType==='xlarge'?28:14)*2**30)throw Error('Effective CPU/memory below requested machine');const model=hw.lscpu.lscpu.find(f=>f.field==='Model name:')?.data||'';if(hw.cpus!==(strategy.machineType==='xlarge'?16:8)||!model.includes('9950X')||!hw.kvm)throw Error('Hardware mismatch; excluded before EAS '+model);
  await Promise.all([write('/tmp/cold-run.sh',fs.readFileSync(path.join(root,'benchmark/cold-run.sh'),'utf8')),write('/tmp/cold-sample.mjs',fs.readFileSync(path.join(root,'benchmark/cold-sample.mjs'),'utf8')),write('/tmp/cold-task.gradle',fs.readFileSync(path.join(root,'research/gradle-task-telemetry.init.gradle'),'utf8')),write('/tmp/cold-prepare.mjs',fs.readFileSync(path.join(root,'benchmark/cold-prepare.mjs'),'utf8'))]);
  if(privateApp)await privateTransfer();else await command(`git clone --depth 1 https://github.com/yast-ai/expo-sample-project.git /tmp/cold-source\ngit -C /tmp/cold-source fetch --depth 1 origin ${sourceSha}\ngit -C /tmp/cold-source checkout --detach ${sourceSha}`,120);
  const app=privateApp?'/tmp/cold-source/apps/mobile':'/tmp/cold-source/variants/native-heavy';
  await write('/tmp/cold-launch.sh',`#!/usr/bin/env bash\nset -Eeuo pipefail\nexec > >(TZ=UTC awk '{print strftime("[%Y-%m-%dT%H:%M:%SZ]"),$0;fflush()}' >> /home/user/benchmark-cold/setup.log) 2>&1\ntrap 'rc=$?; if [ "$rc" -ne 0 ]; then echo ERROR > /home/user/benchmark-cold/cold.status; fi' EXIT\nbash /tmp/cold-run.sh ${app}\n`);
 }else if(!job.sourceTransferred){
  await command('mkdir -p /home/user/benchmark-cold');
  const hw=JSON.parse(await command(`lscpu -J`));const model=hw.lscpu.find(f=>f.field==='Model name:')?.data||'';if(!model.includes('9950X'))throw Error('Hardware mismatch before EAS '+model);
  await Promise.all([write('/tmp/cold-run.sh',fs.readFileSync(path.join(root,'benchmark/cold-run.sh'),'utf8')),write('/tmp/cold-sample.mjs',fs.readFileSync(path.join(root,'benchmark/cold-sample.mjs'),'utf8')),write('/tmp/cold-task.gradle',fs.readFileSync(path.join(root,'research/gradle-task-telemetry.init.gradle'),'utf8')),write('/tmp/cold-prepare.mjs',fs.readFileSync(path.join(root,'benchmark/cold-prepare.mjs'),'utf8'))]);
  await privateTransfer();await write('/tmp/cold-expo-token',token);await command('chmod 600 /tmp/cold-expo-token');
  const launch=`#!/usr/bin/env bash\nset -Eeuo pipefail\nexport JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ANDROID_HOME=/home/user/android-sdk ANDROID_SDK_ROOT=/home/user/android-sdk PATH="/usr/local/bin:/home/user/.bun/bin:/home/user/android-sdk/cmdline-tools/22.0/bin:/home/user/android-sdk/platform-tools:$PATH"\nexport EXPO_TOKEN="$(cat /tmp/cold-expo-token)" COLD_STRATEGY_B64='${Buffer.from(JSON.stringify(strategy)).toString('base64')}'\nexec > >(TZ=UTC awk '{print strftime("[%Y-%m-%dT%H:%M:%SZ]"),$0;fflush()}' >> /home/user/benchmark-cold/setup.log) 2>&1\ntrap 'rc=$?; if [ "$rc" -ne 0 ]; then echo ERROR > /home/user/benchmark-cold/cold.status; fi' EXIT\nbash /tmp/cold-run.sh /tmp/cold-source/apps/mobile\n`;
  await write('/tmp/cold-launch.sh',launch);job.awaitingPrivateTransferApproval=false;save();
 }
 const deadline=Date.now()+1800000;let lastData;
 while(Date.now()<deadline){await sleep(15000);lastData=await capture();const s=(lastData['cold.status']||'').trim();if(s==='ERROR')throw Error('Cold build failed; retained timestamped log');if(s==='SUCCESS'){if(!job.receipt)throw Error('Missing APK receipt');if(!privateApp)await publicArtifact();await retainEvidence();job.status='success';job.runs[0].status='success';break;}const state=(await retry(()=>api.get({sandboxId:job.sandboxId}))).sandbox;if(state.setupStatus==='failed'||['archived','error','cancelled'].includes(state.state))throw Error(state.setupError||state.state);}
 if(job.status!=='success')throw Error('Cold EAS lane deadline');
}catch(e){job.status='error';job.error=safe(e.message||e);if(e.response){job.error+=` HTTP ${e.response.status}`;try{job.error+=' '+safe((await e.response.clone().text()).slice(0,2000));}catch{}}job.runs[0].status='error';job.runs[0].error=privateApp?'Cold build failed; private diagnostic retained':job.error;if(job.error.includes('machine_class_plan_required')){job.status='blocked';job.runs[0].status='blocked';job.terminalReason='16 CPU requires $100/month plan';}console.error(id,job.error);}
finally{const outcome=job.status;if(job.sandboxId){try{await capture();}catch{}for(let i=0;i<4;i++){try{await api.stop({sandboxId:job.sandboxId});job.stopped=true;break;}catch{await sleep(1500);}}}job.status=outcome;job.finishedAt=Date.now();if(job.status==='success')job.runs[0].status='success';else job.runs[0].status=job.status==='blocked'?'blocked':'error';save();console.log(`${id}: ${job.status}, stopped=${job.stopped===true}`);}
