const names = {control:'Hello','js-heavy':'100 screens','native-heavy':'Native','convex-app':'Convex'};
const el = id => document.getElementById(id);
const num = (v,d=1) => Number.isFinite(v) ? v.toFixed(d) : '—';
const sec = v => Number.isFinite(v) ? `${num(v)}s` : '—';
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const metrics = [
  ['Trigger → artifact','endToEndSeconds',sec],
  ['Build time','durationSeconds',sec],['VM CPU · avg','cpuAverage',v=>`${num(v)}%`],
  ['RAM · peak','memoryPeakGiB',v=>`${num(v)} GiB`],['Disk · growth','diskDeltaGiB',v=>`${num(v)} GiB`],
  ['Swap · peak','swapPeakMiB',v=>`${num(v)} MiB`],['File size','artifactMiB',v=>`${num(v)} MiB`]
];
function change(a,b,key,fmt){
  if(a?.status==='success'&&b?.status==='success'&&(!Number.isFinite(a[key])||!Number.isFinite(b[key])))return 'Not recorded';
  if(!a||!b||a.status!=='success'||b.status!=='success'||!Number.isFinite(a[key])||!Number.isFinite(b[key]))return 'Measuring';
  if(key==='durationSeconds'||key==='endToEndSeconds')return b[key]<a[key]?`${num(a[key]/b[key])}× faster`:`${num(b[key]/a[key])}× slower`;
  if(Math.abs(b[key]-a[key])<0.001)return 'Same';
  if(a[key]===0||(key==='swapPeakMiB'&&a[key]<1))return `${fmt(Math.abs(b[key]-a[key]))} ${b[key]>a[key]?'more':'less'}`;
  const percent=(b[key]-a[key])/a[key]*100;
  return Math.abs(percent)<0.05?'Same':`${num(Math.abs(percent))}% ${percent>0?'more':'less'}`;
}
function pair(runs,project,profile,lane='baseline'){
  return ['cold','warm'].map(cache=>{
    const found=runs.filter(r=>r.project===project&&r.profile===profile&&r.cache===cache&&r.lane===lane);
    return found.filter(r=>r.status==='success').at(-1)||found.filter(r=>r.status!=='error').at(-1);
  });
}
function rows(label,key,fmt,groups){
  const max=Math.max(1,...groups.flatMap(g=>g.pair.map(r=>r?.[key]||0)));
  return `<section class="panel"><h2>${label}</h2>${groups.map(g=>`<div class="chart-row"><div class="chart-label"><span>${g.label}</span><span class="delta">${change(...g.pair,key,fmt)}</span></div>${g.pair.map((r,i)=>`<div class="barline"><small>${i?'Warm':'Cold'}</small><div class="track"><div class="bar ${i?'warm':''}" style="width:${Math.min(100,(r?.[key]||0)/max*100)}%"></div></div><span class="barvalue">${r?fmt(r[key]):'—'}</span></div>`).join('')}</div>`).join('')}</section>`;
}
function primaryPair(runs,project,profile){
  const normal=pair(runs,project,profile),eight=pair(runs,project,profile,'eight-workers');
  return normal.every(r=>r?.status==='success')?normal:eight.every(r=>r?.status==='success')?eight:normal;
}
function render(d,force=false){
  const runs=(d.runs||[]).filter(r=>r.profile==='preview'),done=runs.filter(r=>r.status==='success').length;
  el('updated').textContent=new Date(d.updatedAt).toLocaleTimeString();
  el('stats').innerHTML=[['Projects',4],['Builds',`${done} / ${d.plannedBuilds||24}`],['Active VMs',d.activeSandboxes||0],['Provisioned',d.provisioned||0],['Crashes',runs.filter(r=>r.oom).length]].map(([s,n])=>`<div class="stat"><small>${s}</small><div class="number">${n}</div></div>`).join('');
  el('projects').innerHTML=Object.entries(names).map(([id,name])=>{
    const p=d.projects?.[id]||{};
    const artifact=runs.filter(r=>r.project===id&&r.status==='success'&&r.artifactUrl?.startsWith('https://')).at(-1);
    return `<div class="project"><div class="project-head"><h3>${name}</h3><span class="badge ${p.device?'success':'running'}">${p.device?'Device verified':esc(p.status||'creating')}</span></div><small>${esc(p.detail||'SDK 57')}</small><div class="steps">${['source','preview','device'].map(s=>`<div class="step ${p[s]?'done':''}" title="${s}"></div>`).join('')}</div>${artifact?`<a href="${esc(artifact.artifactUrl)}"><small>Preview APK ↗ · ${num(artifact.artifactMiB)} MiB</small></a>`:''}</div>`;
  }).join('');
  el('charts').innerHTML=['preview'].map(profile=>metrics.map(([label,key,fmt])=>rows(`${label} · ${profile==='preview'?'APK':'AAB'}`,key,fmt,Object.entries(names).map(([id,name])=>({label:name+(primaryPair(runs,id,profile)[0]?.workers===8?' · 8 workers':''),pair:primaryPair(runs,id,profile)})))).join('')).join('');
  el('runs').innerHTML=runs.map(r=>`<div class="run"><div class="run-top"><span>${names[r.project]||esc(r.project)} · ${esc(r.profile)}<br><small>${esc(r.cache)} · ${r.workers||6} workers · ${r.lane==='docker'?'Docker':'Raw'}</small></span><span class="badge ${r.status==='success'?'success':r.status==='error'?'error':'running'}">${esc(r.status)}</span></div><div class="run-values"><span><small>Time</small><b>${sec(r.durationSeconds)}</b></span><span><small>CPU</small><b>${num(r.cpuAverage)}%</b></span><span><small>RAM</small><b>${num(r.memoryPeakGiB)} GiB</b></span></div><div class="spark" role="img" aria-label="CPU usage">${(r.cpuSeries||[]).slice(-80).map(v=>`<i style="height:${Math.max(2,v)}%"></i>`).join('')}</div></div>`).join('');
  el('insights').innerHTML=(d.insights||[]).map(i=>`<section class="panel"><small>${esc(i.label)}</small><div class="number">${esc(i.value)}</div><p><span class="badge ${i.status||''}">${esc(i.badge||'measuring')}</span></p></section>`).join('');
  if(el('extras'))el('extras').innerHTML=extras(d,runs);
}
function timeline(runs){
  const stages=[['Provision + setup','provisionSetupSeconds','#9c88ff'],['Build','durationSeconds','#647dff'],['Poll + publish','pollingAndPublishSeconds','#ffc36b'],['Upload','artifactUploadSeconds','#46d6bd']];
  const groups=Object.entries(names).map(([id,name])=>({name,runs:pair(runs,id,'preview')}));
  const max=Math.max(1,...groups.flatMap(g=>g.runs.map(r=>r?.endToEndSeconds||0)));
  return `<section class="panel timeline"><h2>Trigger → APK · phases</h2><div class="legend">${stages.map(([s,k,c])=>`<span><i class="dot" style="background:${c}"></i>${s}</span>`).join('')}</div>${groups.map(g=>`<div class="chart-row"><div class="chart-label"><span>${g.name}</span><span class="delta">${change(...g.runs,'endToEndSeconds',sec)}</span></div>${g.runs.map((r,i)=>`<div class="barline"><small>${i?'Warm':'Cold'}</small><div class="track stacked">${Number.isFinite(r?.endToEndSeconds)?stages.map(([label,key,color])=>`<div title="${label}: ${sec(r[key])}" style="width:${Math.max(0,r[key]||0)/max*100}%;background:${color};height:100%"></div>`).join(''):''}</div><span class="barvalue">${sec(r?.endToEndSeconds)}</span></div>${Number.isFinite(r?.endToEndSeconds)?`<div class="phase-values">${stages.map(([label,key,color])=>`<span style="color:${color}" title="${label}">${sec(r[key])}</span>`).join('')}</div>`:''}`).join('')}</div>`).join('')}</section>`;
}
function extras(d,runs){
  const workerRows=['control','native-heavy'].flatMap(p=>['preview'].map(profile=>({label:`${names[p]} · ${profile==='preview'?'APK':'AAB'}`,pair:[pair(runs,p,profile)[0],pair(runs,p,profile,'eight-workers')[0]]})));
  let html=timeline(runs)+rows('6 → 8 workers · cold','durationSeconds',sec,workerRows).replaceAll('>Cold<','>6<').replaceAll('>Warm<','>8<');
  const docker=pair(runs,'control','preview','docker');
  html+=rows('Raw → Docker','durationSeconds',sec,['cold','warm'].map((cache,i)=>({label:cache,pair:[pair(runs,'control','preview')[i],docker[i]]}))).replaceAll('>Cold<','>Raw<').replaceAll('>Warm<','>Docker<');
  if(d.cloudRuns?.length)html+=rows('EAS cloud · trigger → APK','durationSeconds',sec,[{label:'Preview · '+(d.cloudRuns.find(r=>r.profile==='preview')?.providerStatus||'pending'),pair:[(()=>{const r=d.cloudRuns.find(r=>r.profile==='preview');return r&&r.status!=='success'&&r.triggeredAt?{...r,durationSeconds:(Date.now()-new Date(r.triggeredAt).getTime())/1000}:r})(),undefined]}]).replaceAll('>Cold<','>Cloud<').replaceAll('>Warm<','>—<');
  return html;
}
async function tick(force=false){try{const r=await fetch('./data.json?'+Date.now(),{cache:'no-store'});if(!r.ok)throw Error();render(await r.json(),force===true);el('live').textContent='LIVE';}catch{el('live').textContent='RECONNECTING';}}
tick();setInterval(tick,5000);
