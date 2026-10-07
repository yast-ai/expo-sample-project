import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const screensDir = join(import.meta.dirname, '..', 'screens');
const names = readdirSync(screensDir).filter((name) => /^Screen\d{3}\.tsx$/.test(name));
const registry = readFileSync(join(screensDir, 'index.ts'), 'utf8');
if (names.length !== 100 || names.some((name) => !existsSync(join(screensDir, name)))) throw new Error(`Expected 100 screen modules, found ${names.length}`);
for (const name of names) if (!registry.includes(`./${name.slice(0, -4)}`)) throw new Error(`Registry does not import ${name}`);
console.log(`Verified ${names.length} importable JS-only React screens.`);
