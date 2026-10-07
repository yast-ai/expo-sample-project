import fs from 'node:fs';
import path from 'node:path';

const [projectRoot, specPath, workloadId] = process.argv.slice(2);
if (!projectRoot || !specPath || !workloadId) throw new Error('Usage: apply-eas-preview-overlay.mjs <project-root> <projects.json> <workload-id>');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8')).projects.find((item) => item.id === workloadId);
if (!spec) throw new Error(`No workload spec matches ${workloadId}`);
const declared = {
  'bluesky-social-app': { slug: 'benchmark-bluesky-social', scheme: 'yastbenchbluesky', androidPackage: 'ai.yast.benchmark.blueskysocial' },
  'expo-forge-mobile': { slug: 'benchmark-expo-forge', scheme: 'yastbenchexpoforge', androidPackage: 'ai.yast.benchmark.expoforge' },
  'expo-with-pdf': { slug: 'benchmark-expo-pdf', scheme: 'yastbenchexpopdf', androidPackage: 'ai.yast.benchmark.expopdf' },
  'react-native-paper-example': { slug: 'benchmark-react-native-paper', scheme: 'yastbenchrnpaper', androidPackage: 'ai.yast.benchmark.rnpaper' },
  'obytes-template': { slug: 'benchmark-obytes', scheme: 'yastbenchobytes', androidPackage: 'ai.yast.benchmark.obytes' },
}[spec.id];
const identity = {
  name: spec.name,
  ...declared,
  owner: 'yast-ai',
  projectId: spec.easProjectId,
};
const merge = (expo) => ({
  ...expo,
  name: identity.name,
  slug: identity.slug,
  owner: identity.owner,
  scheme: identity.scheme,
  android: { ...expo.android, package: identity.androidPackage },
  ios: { ...expo.ios, bundleIdentifier: identity.androidPackage },
  updates: { ...expo.updates, url: `https://u.expo.dev/${identity.projectId}` },
  extra: { ...expo.extra, eas: { ...expo.extra?.eas, projectId: identity.projectId } },
});
const appJson = path.join(projectRoot, 'app.json');
const appJs = path.join(projectRoot, 'app.config.js');
const appTs = path.join(projectRoot, 'app.config.ts');
if (fs.existsSync(appJson)) {
  const config = JSON.parse(fs.readFileSync(appJson, 'utf8'));
  fs.writeFileSync(appJson, `${JSON.stringify({ ...config, expo: merge(config.expo ?? {}) }, null, 2)}\n`);
} else if (fs.existsSync(appJs)) {
  fs.renameSync(appJs, path.join(projectRoot, 'app.upstream.config.js'));
  fs.writeFileSync(appJs, `const upstream = require('./app.upstream.config.js');\nconst identity = ${JSON.stringify(identity)};\nconst merge = (expo) => ({ ...expo, name: identity.name, slug: identity.slug, owner: identity.owner, scheme: identity.scheme, android: { ...expo.android, package: identity.androidPackage }, ios: { ...expo.ios, bundleIdentifier: identity.androidPackage }, updates: { ...expo.updates, url: \`https://u.expo.dev/\${identity.projectId}\` }, extra: { ...expo.extra, eas: { ...expo.extra?.eas, projectId: identity.projectId } } });\nmodule.exports = (ctx) => { const result = typeof upstream === 'function' ? upstream(ctx) : upstream; return result.expo ? { ...result, expo: merge(result.expo) } : merge(result); };\n`);
} else if (fs.existsSync(appTs)) {
  fs.renameSync(appTs, path.join(projectRoot, 'app.upstream.config.ts'));
  fs.writeFileSync(appTs, `import 'tsx/cjs';\nconst upstream = require('./app.upstream.config.ts').default;\nconst identity = ${JSON.stringify(identity)};\nexport default (ctx: any) => { const expo: any = upstream(ctx); return { ...expo, name: identity.name, slug: identity.slug, owner: identity.owner, scheme: identity.scheme, android: { ...expo.android, package: identity.androidPackage }, ios: { ...expo.ios, bundleIdentifier: identity.androidPackage }, updates: { ...expo.updates, url: \`https://u.expo.dev/\${identity.projectId}\` }, extra: { ...expo.extra, eas: { ...expo.extra?.eas, projectId: identity.projectId } } }; };\n`);
} else throw new Error(`No Expo config found in ${projectRoot}`);
const easPath = path.join(projectRoot, 'eas.json');
const eas = fs.existsSync(easPath) ? JSON.parse(fs.readFileSync(easPath, 'utf8')) : {};
eas.cli = { ...eas.cli, appVersionSource: 'remote' };
const forgePreviewEnv = spec.id === 'expo-forge-mobile' ? {
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_YmVuY2htYXJrLmludmFsaWQk',
  EXPO_PUBLIC_SUPABASE_URL: 'https://benchmark.invalid',
  EXPO_PUBLIC_SUPABASE_KEY: 'benchmark-placeholder-key',
} : {};
eas.build = { ...eas.build, preview: { ...eas.build?.preview, distribution: 'internal', channel: 'preview', env: { ...eas.build?.preview?.env, ...forgePreviewEnv }, android: { ...eas.build?.preview?.android, buildType: 'apk' } } };
fs.writeFileSync(easPath, `${JSON.stringify(eas, null, 2)}\n`);
console.log(JSON.stringify({ workload: spec.id, identity, profile: eas.build.preview }, null, 2));
