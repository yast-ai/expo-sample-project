import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'forge-runtime-env-'));
try {
  fs.writeFileSync(path.join(temp,'app.json'),JSON.stringify({expo:{plugins:['expo-router']}}));
  const production={android:{buildType:'app-bundle'},env:{KEEP:'production'}};
  fs.writeFileSync(path.join(temp,'eas.json'),JSON.stringify({build:{production,preview:{env:{KEEP:'preview'}}}}));
  execFileSync(process.execPath,[path.join(root,'apply-eas-preview-overlay.mjs'),temp,path.join(root,'projects.json'),'expo-forge-mobile']);
  const {build}=JSON.parse(fs.readFileSync(path.join(temp,'eas.json')));
  for(const key of ['EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY','EXPO_PUBLIC_SUPABASE_URL','EXPO_PUBLIC_SUPABASE_KEY'])assert.ok(build.preview.env[key],`${key} absent from packaged EAS profile`);
  const key=build.preview.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  assert.equal(key.split('_').length,3);
  assert.equal(Buffer.from(key.split('_')[2],'base64').toString(),'benchmark.invalid$');
  assert.equal(new URL(build.preview.env.EXPO_PUBLIC_SUPABASE_URL).hostname,'benchmark.invalid');
  assert.equal(build.preview.env.KEEP,'preview');
  assert.deepEqual(build.production,production);
  assert.equal(build.preview.android.buildType,'apk');
  console.log('Forge public runtime values are packaged; production profile preserved');
} finally {fs.rmSync(temp,{recursive:true,force:true});}
