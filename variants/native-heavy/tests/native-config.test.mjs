import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url))).expo;
const packages = JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).dependencies;
const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url))).build;
test('declares the native benchmark workload', () => {
  for (const name of ['@shopify/react-native-skia', 'expo-camera', 'expo-sqlite', 'expo-location', 'expo-audio', 'expo-video']) assert.ok(packages[name]);
  assert.equal(app.owner, 'yast-ai'); assert.equal(app.android.package, 'ai.yast.nativelab');
  assert.equal(eas.preview.android.buildType, 'apk');
  assert.equal(eas.production.android.buildType, 'app-bundle');
});
