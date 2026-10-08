import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {bundledBuildPropertiesVersion, exactBuildPropertiesVersion, prepareProject, upsertPlugin, verifyPrivateRegistration} from './cold-prepare.mjs';

const json = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const fixture = ({privateApp = false, installed = false} = {}) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cold-prepare-'));
  const app = privateApp ? path.join(root, 'apps/mobile') : path.join(root, 'variants/native-heavy');
  fs.mkdirSync(app, {recursive: true});
  json(path.join(app, 'package.json'), {dependencies: {expo: privateApp ? '~58.0.8' : '~57.0.27', 'react-native': '0.86.3'}});
  json(path.join(app, 'app.json'), {expo: {android: {architectures: ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64']}, plugins: ['expo-router', ['expo-splash-screen', {image: 'x'}]]}});
  if (installed) {
    const bundled = path.join(root, 'node_modules/expo'); fs.mkdirSync(bundled, {recursive: true});
    json(path.join(bundled, 'bundledNativeModules.json'), {'expo-build-properties': '~57.0.22'});
  }
  return {root, app};
};

test('public preparation uses Expo SDK 57 bundled pin, installs only in the disposable copy, and keeps all four ABIs', () => {
  const {app} = fixture({installed: true});
  const before = fs.readFileSync(path.join(app, 'app.json'), 'utf8');
  const calls = [];
  const result = prepareProject(app, {run: (...args) => calls.push(args)});
  const pkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json')));
  const config = JSON.parse(fs.readFileSync(path.join(app, 'app.json')));
  assert.equal(bundledBuildPropertiesVersion(app), '~57.0.22');
  assert.equal(exactBuildPropertiesVersion(bundledBuildPropertiesVersion(app)), '57.0.22');
  assert.deepEqual(calls, [['bun', ['add', '--lockfile-only', '--ignore-scripts', 'expo-build-properties@57.0.22'], {cwd: app, stdio: 'inherit'}]]);
  assert.equal(result.dependency, '57.0.22');
  assert.equal(pkg.dependencies['expo-build-properties'], undefined, 'mocked bun owns package/lock mutation');
  assert.deepEqual(config.expo.android.architectures, ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64']);
  const plugin = config.expo.plugins.find(p => Array.isArray(p) && p[0] === 'expo-build-properties');
  assert.deepEqual(plugin, ['expo-build-properties', {android: {usePrecompiledHeaders: false}}]);
  assert.match(before, /expo-router/);
});

test('plugin update is idempotent, preserves unrelated Android options, and rejects duplicates', () => {
  const config = {expo: {plugins: [['expo-build-properties', {android: {compileSdkVersion: 37}, ios: {deploymentTarget: '16.4'}}] ]}};
  upsertPlugin(config, false); upsertPlugin(config, false);
  assert.equal(config.expo.plugins.length, 1);
  assert.deepEqual(config.expo.plugins[0], ['expo-build-properties', {android: {compileSdkVersion: 37, usePrecompiledHeaders: false}, ios: {deploymentTarget: '16.4'}}]);
  assert.throws(() => upsertPlugin({expo: {plugins: ['expo-build-properties', 'expo-build-properties']}}), /registered 2 times/);
});

test('private mobile preparation verifies existing JSON and TypeScript registrations without mutation', () => {
  const {app} = fixture({privateApp: true});
  const config = JSON.parse(fs.readFileSync(path.join(app, 'app.json')));
  config.expo.plugins.push(['expo-build-properties', {android: {usePrecompiledHeaders: false}}]);
  json(path.join(app, 'app.json'), config);
  fs.writeFileSync(path.join(app, 'app.config.ts'), "import app from './app.json'; export default { expo: { ...app.expo, plugins: [...app.expo.plugins] } };\n");
  const original = fs.readFileSync(path.join(app, 'app.json'), 'utf8');
  assert.deepEqual(verifyPrivateRegistration(app), {jsonRegistrations: 1, configRegistrations: 1, inherited: true});
  assert.equal(prepareProject(app).changed, false);
  assert.equal(fs.readFileSync(path.join(app, 'app.json'), 'utf8'), original);
});
