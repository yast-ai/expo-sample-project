import {execFileSync} from 'node:child_process';
const root=process.cwd();
function deploy(){
  try{execFileSync('vercel',['--prod','--yes'],{cwd:root+'/dashboard',stdio:['ignore','pipe','pipe']});console.log(new Date().toISOString(),'Dashboard deployed');}
  catch(e){console.error('Dashboard deployment failed',e.stderr?.toString().slice(-1000));}
}
deploy();setInterval(deploy,90000);
