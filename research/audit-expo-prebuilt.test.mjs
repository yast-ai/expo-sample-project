import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { auditPackage } from './audit-expo-prebuilt.mjs';

test('native bytes invalidate; JavaScript and excluded native paths do not', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'expo-hash-fixture-'));
  const put = (name, text) => {
    fs.mkdirSync(path.dirname(path.join(directory, name)), { recursive: true });
    fs.writeFileSync(path.join(directory, name), text);
  };
  try {
    put('android/build.gradle', 'static final List<String> SOURCE_ROOTS = ["native"]\nstatic final List<String> SOURCE_EXCLUDES = ["native/tests"]');
    put('native/a.cpp', 'original');
    put('native/tests/ignored.cpp', 'test');
    const expected = crypto.createHash('md5').update('native/a.cpp\0original\0').digest('hex');
    put('android/prebuilt/metadata.json', JSON.stringify({ sourceHash: expected }));
    assert.equal(auditPackage(directory).matches, true);
    put('build/NativeModulesProxy.native.js', 'changed JS');
    put('native/tests/ignored.cpp', 'changed excluded native');
    assert.equal(auditPackage(directory).matches, true);
    put('native/a.cpp', 'changed native');
    assert.equal(auditPackage(directory).matches, false);
    assert.equal(auditPackage(directory).fileCount, 1);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
