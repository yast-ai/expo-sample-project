#!/usr/bin/env node
// Read-only audit of Expo's published native-source hash. Never evaluates package code.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function auditPackage(directory) {
  const gradle = fs.readFileSync(path.join(directory, 'android/build.gradle'), 'utf8');
  const readList = name => {
    const match = gradle.match(new RegExp(`static final List<String> ${name} = \\[([\\s\\S]*?)\\]`));
    if (!match) throw new Error(`Unsupported source guard: missing ${name}`);
    const body = match[1].replace(/\/\/[^\n]*/g, '');
    if (body.replace(/"[^"\n]*"/g, '').replace(/[\s,]/g, '')) throw new Error(`Unsupported ${name} syntax`);
    return [...body.matchAll(/"([^"\n]*)"/g)].map(m => {
      if (path.isAbsolute(m[1]) || m[1].split('/').includes('..')) throw new Error('Unsafe source-root path');
      return m[1];
    });
  };
  const roots = readList('SOURCE_ROOTS');
  const exclusions = readList('SOURCE_EXCLUDES');
  const files = [];
  function collect(relative) {
    if (exclusions.includes(relative)) return;
    const file = path.join(directory, relative);
    if (!fs.existsSync(file)) return; // Same missing-root behavior as the source guard.
    if (fs.lstatSync(file).isSymbolicLink()) throw new Error('Symlinked source unsupported by this audit');
    if (fs.statSync(file).isDirectory()) {
      for (const name of fs.readdirSync(file)) if (!name.startsWith('.')) collect(`${relative}/${name}`);
    } else if (fs.statSync(file).isFile()) files.push(relative);
  }
  roots.forEach(collect);
  files.sort();
  const hash = crypto.createHash('md5');
  const digests = {};
  for (const relative of files) {
    const bytes = fs.readFileSync(path.join(directory, relative));
    hash.update(relative, 'utf8').update('\0').update(bytes).update('\0');
    digests[relative] = crypto.createHash('sha256').update(bytes).digest('hex');
  }
  const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'android/prebuilt/metadata.json'), 'utf8'));
  const actualSourceHash = hash.digest('hex');
  return { fileCount: files.length, actualSourceHash, expectedSourceHash: metadata.sourceHash,
    matches: actualSourceHash === metadata.sourceHash, roots, exclusions, digests };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    const [directory, installed] = process.argv.slice(2);
    if (!directory) throw new Error('Usage: node audit-expo-prebuilt.mjs <extracted-public-package> [installed-package]');
    const original = auditPackage(directory);
    const { digests, ...report } = original;
    if (installed) {
      const comparison = auditPackage(installed);
      report.installed = { fileCount: comparison.fileCount, actualSourceHash: comparison.actualSourceHash,
        matchesMetadata: comparison.matches,
        differingSourceFiles: [...new Set([...Object.keys(digests), ...Object.keys(comparison.digests)])]
          .filter(name => digests[name] !== comparison.digests[name]).sort() };
    }
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.matches && (!report.installed || report.installed.differingSourceFiles.length === 0) ? 0 : 1;
  } catch (error) {
    console.error(JSON.stringify({ error: error.message }));
    process.exitCode = 2;
  }
}
