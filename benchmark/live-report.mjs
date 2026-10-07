import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
const root=process.cwd(),report=fs.existsSync('dashboard')?'dashboard':'report';
const require=createRequire(path.join(root,fs.existsSync('backend')?'backend/package.json':'expo-sample-project/backend/package.json'));
const {S3Client,PutObjectCommand}=require('@aws-sdk/client-s3');
const config=JSON.parse(fs.readFileSync(process.env.REPORT_R2_CREDENTIALS||'/private/tmp/expo-r2-credentials.json','utf8'));
const client=new S3Client({region:'auto',endpoint:config.R2_ENDPOINT,credentials:{accessKeyId:config.R2_ACCESS_KEY_ID,secretAccessKey:config.R2_SECRET_ACCESS_KEY}});
const privateValues=[config.R2_SECRET_ACCESS_KEY,config.R2_ACCESS_KEY_ID,...['/private/tmp/expo-build-token','/private/tmp/expo-build-previous-token','/private/tmp/expo-sample-boat-key'].filter(fs.existsSync).map(p=>fs.readFileSync(p,'utf8').trim())].filter(Boolean).flatMap(v=>[v,Buffer.from(v).toString('base64')]);
const hashes=new Map(),types={'index.html':'text/html','app.js':'text/javascript','data.json':'application/json'};
async function publish(){new Script(fs.readFileSync(path.join(report,'app.js'),'utf8'));JSON.parse(fs.readFileSync(path.join(report,'data.json'),'utf8'));for(const [file,type] of Object.entries(types)){let body=fs.readFileSync(path.join(report,file));if(file==='index.html'){const version=createHash('sha256').update(fs.readFileSync(path.join(report,'app.js'))).digest('hex').slice(0,12);body=Buffer.from(body.toString().replace(/src="\.\/app\.js(?:\?[^"]*)?"/,`src="./app.js?v=${version}"`));}if(privateValues.some(v=>body.includes(v)))throw Error('Public report secret scan failed');const hash=createHash('sha256').update(body).digest('hex');if(hashes.get(file)===hash)continue;await client.send(new PutObjectCommand({Bucket:config.R2_BUCKET,Key:`benchmarks/report/${file}`,Body:body,ContentType:type,CacheControl:'no-store'}));hashes.set(file,hash);}console.log(new Date().toISOString(),'Live report updated');}
await publish();if(!process.argv.includes('--once'))setInterval(()=>publish().catch(e=>console.error('Report update failed:',e.name)),15000);
