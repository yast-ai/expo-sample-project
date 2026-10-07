import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))), target=path.join(root,'dashboard/data.json');
function update(){
  const d=JSON.parse(fs.readFileSync(target,'utf8')), directory=path.join(root,'benchmark/jobs');
  const jobs=fs.existsSync(directory)?fs.readdirSync(directory).filter(n=>n.endsWith('.json')).map(n=>{try{return JSON.parse(fs.readFileSync(path.join(directory,n),'utf8'))}catch{return null}}).filter(Boolean).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)):[];
  d.plannedBuilds=22;d.updatedAt=new Date().toISOString();d.runs=jobs.flatMap(j=>j.runs);d.provisioned=new Set(jobs.filter(j=>j.sandboxId).map(j=>j.sandboxId)).size;d.activeSandboxes=jobs.filter(j=>j.sandboxId&&!j.stopped).length;
  for(const [id,p] of Object.entries(d.projects)){const app=path.join(root,id==='control'?'expo-sample-project':`workspace/variants/${id}`);if(fs.existsSync(path.join(app,'READY.json'))||id==='control'){p.status='ready';p.source=true;}for(const profile of ['preview','production'])p[profile]=jobs.some(j=>j.project===id&&j.profile===profile&&j.status==='success');}
  const convexEvidence=path.join(root,'verification/convex-device.json');if(fs.existsSync(convexEvidence)){const e=JSON.parse(fs.readFileSync(convexEvidence,'utf8'));d.projects['convex-app'].device=e.success;d.insights[2]={label:'Convex APK',value:e.success?'Verified':'Pending',badge:e.success?'Persistence + live query':'Device check',status:e.success?'success':''};}
  const devices=path.join(root,'verification/project-devices.json');if(fs.existsSync(devices)){for(const r of JSON.parse(fs.readFileSync(devices,'utf8')).results||[]){const id={'ai.yast.exposampleproject':'control','ai.yast.exposampleproject.jsheavy':'js-heavy','ai.yast.expoconvexsample':'convex-app','ai.yast.nativelab':'native-heavy'}[r.package];if(id)d.projects[id].device=r.success;}}
  const cloud=path.join(root,'verification/eas-cloud.json');if(fs.existsSync(cloud))d.cloudRuns=JSON.parse(fs.readFileSync(cloud,'utf8'));
  delete d.storagePricing;
  fs.writeFileSync(target+'.tmp',JSON.stringify(d,null,2));fs.renameSync(target+'.tmp',target);
}
update();setInterval(update,3000);
