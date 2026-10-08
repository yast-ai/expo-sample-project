#!/usr/bin/env node
/**
 * Prepares a disposable Expo project copy for the Android PCH control/treatment.
 *
 * Public SDK 57 projects receive the SDK-pinned config plugin. The plugin stays
 * explicitly disabled in app.json: Expo's documented
 * EXPO_USE_ANDROID_PRECOMPILED_HEADERS=1 environment switch selects the treatment
 * at prebuild time. This keeps the source/config delta identical for both lanes.
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

// `expo` records this as a compatible range, but controls must resolve the same
// package bytes: the pinned registry version was verified as 57.0.22.
const SDK_BUILD_PROPERTIES = Object.freeze({57: '57.0.22'});
const PLUGIN = 'expo-build-properties';

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

export function bundledBuildPropertiesVersion(appPath) {
  for (let current = path.resolve(appPath); ; current = path.dirname(current)) {
    const bundled = path.join(current, 'node_modules/expo/bundledNativeModules.json');
    if (fs.existsSync(bundled)) {
      const version = readJson(bundled)[PLUGIN];
      if (typeof version === 'string') return version;
      throw new Error(`${bundled} does not declare ${PLUGIN}`);
    }
    const parent = path.dirname(current);
    if (parent === current) break;
  }
  const expo = readJson(path.join(appPath, 'package.json')).dependencies?.expo;
  const major = Number(String(expo ?? '').match(/\d+/)?.[0]);
  const version = SDK_BUILD_PROPERTIES[major];
  if (!version) throw new Error(`No checked-in ${PLUGIN} pin for Expo ${expo ?? 'unknown'}`);
  return version;
}

export function exactBuildPropertiesVersion(compatibleVersion) {
  const exact = String(compatibleVersion).replace(/^~/, '');
  if (!/^\d+\.\d+\.\d+$/.test(exact)) throw new Error(`Cannot make an exact ${PLUGIN} pin from ${compatibleVersion}`);
  return exact;
}

export function isPrivateMobileProject(appPath) {
  const parts = path.resolve(appPath).split(path.sep);
  return parts.at(-2) === 'apps' && parts.at(-1) === 'mobile';
}

export function upsertPlugin(config, enabled = false) {
  const expo = config.expo ??= {};
  const plugins = expo.plugins ??= [];
  const matches = plugins.map((entry, index) => ({entry, index}))
    .filter(({entry}) => entry === PLUGIN || (Array.isArray(entry) && entry[0] === PLUGIN));
  if (matches.length > 1) throw new Error(`${PLUGIN} is registered ${matches.length} times`);
  const options = matches.length && Array.isArray(matches[0].entry)
    ? structuredClone(matches[0].entry[1] ?? {}) : {};
  options.android = {...(options.android ?? {}), usePrecompiledHeaders: enabled};
  const replacement = [PLUGIN, options];
  if (matches.length) plugins[matches[0].index] = replacement;
  else plugins.push(replacement);
  return config;
}

export function verifyPrivateRegistration(appPath) {
  const jsonPath = path.join(appPath, 'app.json');
  const tsPath = path.join(appPath, 'app.config.ts');
  const json = readJson(jsonPath);
  const jsonMatches = (json.expo?.plugins ?? []).filter(entry => entry === PLUGIN || (Array.isArray(entry) && entry[0] === PLUGIN));
  if (jsonMatches.length !== 1) throw new Error(`private app.json must register ${PLUGIN} exactly once`);
  if (!fs.existsSync(tsPath)) throw new Error('private app.config.ts is required for verification');
  const source = fs.readFileSync(tsPath, 'utf8');
  const tsMatches = source.match(/['\"]expo-build-properties['\"]/g) ?? [];
  const inheritsJsonPlugins = /(?:app|baseConfig|appConfig)\.expo\.plugins/.test(source);
  // The private config imports app.json then spreads app.expo.plugins. Its TypeScript
  // source rightly has no second literal plugin entry, so count inheritance once.
  if (tsMatches.length > 1 || (tsMatches.length === 0 && !inheritsJsonPlugins)) {
    throw new Error(`private app.config.ts must register or inherit ${PLUGIN} exactly once`);
  }
  return {jsonRegistrations: jsonMatches.length, configRegistrations: 1, inherited: tsMatches.length === 0};
}

export function prepareProject(appPath, {run = null} = {}) {
  const packagePath = path.join(appPath, 'package.json');
  const configPath = path.join(appPath, 'app.json');
  if (!fs.existsSync(packagePath) || !fs.existsSync(configPath)) throw new Error(`Expected package.json and app.json in ${appPath}`);
  if (isPrivateMobileProject(appPath)) return {kind: 'private', appPath, ...verifyPrivateRegistration(appPath), changed: false};

  const pkg = readJson(packagePath);
  const version = exactBuildPropertiesVersion(bundledBuildPropertiesVersion(appPath));
  const existing = pkg.dependencies?.[PLUGIN];
  if (existing && existing !== version) throw new Error(`${PLUGIN} is ${existing}; expected exact SDK pin ${version}`);
  if (!existing) {
    const invoke = run ?? ((command, args, options) => execFileSync(command, args, options));
    // This runs only against the disposable runner copy. It updates its bun.lock,
    // then the runner's frozen install verifies the exact resolved graph.
    invoke('bun', ['add', '--lockfile-only', '--ignore-scripts', `${PLUGIN}@${version}`], {cwd: appPath, stdio: 'inherit'});
  }

  const config = upsertPlugin(readJson(configPath), false);
  writeJson(configPath, config);
  return {kind: 'public', appPath, dependency: version, installed: !existing, pchConfig: false, changed: true};
}

function main() {
  const appPath = process.argv[2];
  if (!appPath || process.argv.length !== 3) throw new Error('Usage: cold-prepare.mjs <app-path>');
  // EXPO_USE_ANDROID_PRECOMPILED_HEADERS is deliberately not written into app.json.
  // It is the runner-owned, 0/1 treatment switch consumed by Expo during prebuild.
  const result = prepareProject(path.resolve(appPath));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
