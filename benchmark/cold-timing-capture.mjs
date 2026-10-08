import fs from 'node:fs';import {createRequire} from 'node:module';
const {BoatApi,Configuration}=createRequire(import.meta.url)('../backend/node_modules/@boatdev/sdk/dist/index.js');const api=new BoatApi(new Configuration({accessToken:fs.readFileSync('/private/tmp/expo-sample-boat-key','utf8').trim()}));
const jobs=fs.readdirSync('benchmark/jobs').filter(n=>n.startsWith('cold-')).map(n=>JSON.parse(fs.readFileSync('benchmark/jobs/'+n))).filter(j=>j.sandboxId&&!j.stopped&&!j.awaitingPrivateTransferApproval);
const script=`#!/bin/bash
set -u
out=/home/user/benchmark-cold/timing-archive
mkdir -p "$out"
for iteration in {1..180}; do
 for base in /tmp/cold-eas/build/android/app/build/intermediates/cxx /tmp/cold-eas/build/apps/mobile/android/app/build/intermediates/cxx; do
  test -d "$base" || continue
  find "$base" -type f \\( -name '*_timing.txt' -o -name '*configure*command*' -o -name '*configure*stdout*' -o -name '*configure*stderr*' \\) -exec cp --parents {} "$out"/ \\;
 done
 test -f /home/user/benchmark-cold/cold.status && break
 sleep 10
done
`;
const b64=Buffer.from(script).toString('base64');const results=await Promise.allSettled(jobs.map(async j=>{const r=await api.command({sandboxId:j.sandboxId,commandRequest:{command:`printf '%s' '${b64}' | base64 -d > /tmp/cold-timings.sh\nnohup bash /tmp/cold-timings.sh > /tmp/cold-timings.log 2>&1 < /dev/null &`,timeoutSeconds:20}});return {id:j.id,exitCode:r.exitCode};}));for(const r of results)console.log(JSON.stringify(r.status==='fulfilled'?r.value:{error:r.reason.name}));
