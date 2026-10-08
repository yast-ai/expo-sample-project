import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';
const script=readFileSync(new URL('./cold-run.sh',import.meta.url),'utf8');
test('cold runner fixes the release ABI/profile contract and preserves an existing Metro config',()=>{execFileSync('bash',['-n',new URL('./cold-run.sh',import.meta.url).pathname]);assert.match(script,/assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64/);assert.match(script,/kotlin\.compiler\.execution\.strategy=in-process/);assert.match(script,/config\.maxWorkers=\$\{metro\}/);assert.match(script,/fs\.existsSync\(m\)\?fs\.readFileSync/);assert.doesNotMatch(script,/enableR8=false|shrinkResources=false/);assert.match(script,/for abi in armeabi-v7a arm64-v8a x86 x86_64/);assert.match(script,/-DCCACHE_FOUND=OFF/);assert.match(script,/android\/app\/src\/main\/jni\/pch\.h/);assert.match(script,/PCH_INERT/);for(const file of ['build.log','tasks-cold.ndjson','metrics.ndjson','cold.start','cold.end','cold.status','cold.receipt','hardware.json','native-evidence.json','processes.ndjson'])assert.ok(script.includes(file),`missing ${file}`);});

// Validate the real embedded strategy parser with representative guest resources.
test('xlarge strategy renders requested values and rejects CPU/memory oversubscription',async()=>{
 const {runInNewContext}=await import('node:vm');
 const source=script.match(/node - "\$COLD_STRATEGY_B64"[^\n]*\n([\s\S]*?)\nJS/)[1];
 const check=(strategy,cpus=16,ram=32)=>{const lines=[];runInNewContext(source,{Buffer,process:{argv:['node','-',Buffer.from(JSON.stringify(strategy)).toString('base64')]},require:()=>({availableParallelism:()=>cpus,totalmem:()=>ram*1024**3}),console:{log:x=>lines.push(x)}});return lines.join('\n');};
 const x={id:'X',workers:12,heapMiB:8192,metroWorkers:4,pch:true,ninjaJobs:8};
 assert.match(check(x),/WORKERS="12"/);assert.match(check(x),/HEAP="8192"/);assert.match(check(x),/NINJA="8"/);
 assert.throws(()=>check(x,8));assert.throws(()=>check(x,16,16));assert.throws(()=>check({...x,workers:32}));
 assert.match(script,/org.gradle.jvmargs=-Xmx%sm/);assert.match(script,/"\$WORKERS" "\$HEAP" > "\$cache\/gradle.properties"/);assert.match(script,/heapMiB:\+heap,metroWorkers:\+metro/);
});
