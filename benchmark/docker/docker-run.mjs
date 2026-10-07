import { execFileSync } from 'node:child_process';

const sourceSha = process.argv[2] ?? '2f725a330e2385da1bccaa6a631cfba37291ce8c';
const docker = execFileSync('docker', ['--version'], { encoding: 'utf8' }).trim();
console.log(JSON.stringify({
  sourceSha,
  docker,
  image: 'expo-android-benchmark:node24',
  profile: 'preview',
  workers: 6,
  caches: ['Bun', 'Gradle'],
  freshEasWorkingDirectory: true,
}, null, 2));
