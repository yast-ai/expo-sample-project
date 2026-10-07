import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root=process.cwd(),backend=path.join(root,'backend');
const convex=(fn,args)=>JSON.parse(execFileSync('bunx',['convex','run',fn,JSON.stringify(args)],{cwd:backend,encoding:'utf8',stdio:['ignore','pipe','pipe']}));
for(const file of fs.readdirSync('benchmark/jobs').filter(n=>n.endsWith('.json'))){
  const filename=path.join('benchmark/jobs',file),job=JSON.parse(fs.readFileSync(filename,'utf8'));
  if(job.status!=='success'||!job.stopped)continue;
  let changed=false;
  for(const run of job.runs){
    if(run.artifactId||!run.artifactUrl)continue;
    const local=path.join(root,'verification/benchmarks',job.id,`${run.cache}.${run.profile==='preview'?'apk':'aab'}`);
    if(!fs.existsSync(local))continue;
    const url=convex('artifacts:uploadUrl',{});
    const uploadStartedAt=Date.now();
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':run.profile==='preview'?'application/vnd.android.package-archive':'application/octet-stream'},body:fs.createReadStream(local),duplex:'half'});
    if(!response.ok)throw Error(`Artifact upload HTTP${response.status}: ${await response.text()}`);
    const {storageId}=await response.json();
    run.artifactUploadSeconds=(Date.now()-uploadStartedAt)/1000;run.artifactId=storageId;run.artifactUrl=convex('artifacts:getUrl',{id:storageId});run.artifactReadyAt=Date.now();changed=true;
    console.log(`${job.id}/${run.cache}: stored ${run.artifactMiB?.toFixed(1)}MiB`);
  }
  if(changed)fs.writeFileSync(filename,JSON.stringify(job,null,2));
}
