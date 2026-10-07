import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),report=fs.existsSync(root+'/dashboard')?root+'/dashboard':root+'/report';
function deploy(){
  try{execFileSync('vercel',['--prod','--yes'],{cwd:report,stdio:['ignore','pipe','pipe']});console.log(new Date().toISOString(),'Dashboard deployed');}
  catch(e){console.error('Dashboard deployment failed',e.stderr?.toString().slice(-1000));}
}
deploy();
