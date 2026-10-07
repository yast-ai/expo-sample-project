import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, parseSamples } from './metrics.mjs';
test('exclude setup and the other build; detect OOM and disk growth inside the measured run', () => {
  const row = (time, cpu, diskUsed, oom) => ({time,cpu,diskUsed,oom,memoryUsed:2**30,memoryAvailable:14*2**30,swapUsed:0});
  const result = summarize([row(0,100,0,0),row(1000,50,2**30,0),row(2000,70,3*2**30,1),row(3000,100,100*2**30,2)],1000,2000);
  assert.equal(result.cpuAverage,60); assert.equal(result.diskDeltaGiB,2); assert.equal(result.oom,true); assert.equal(result.sampleCount,2);
});

test('a partial final metrics write cannot abort a healthy build', () => {
  assert.deepEqual(parseSamples('{"time":1}\n{"time":'), [{time:1}]);
  assert.deepEqual(parseSamples('{"time":1}'), [{time:1}]);
  assert.throws(() => parseSamples('corrupt\n{"time":1}\n'));
});
