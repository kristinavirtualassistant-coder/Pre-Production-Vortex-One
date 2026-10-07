#!/usr/bin/env node
/**
 * `npm test`: runs the integrated suite (server/test/suite.ts) and then EVERY other server/test/*.test.ts file as its own
 * process, so no test file can silently go unexecuted. Any non-zero exit fails the run.
 * Excluded: browserSmoke.test.ts (needs a built app + browser; run with `npm run test:e2e:smoke`).
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const testDir = 'server/test';
const suiteSource = readFileSync(path.join(testDir, 'suite.ts'), 'utf8');
const importedBySuite = new Set([...suiteSource.matchAll(/from '\.\/([A-Za-z0-9_]+\.test)'|import '\.\/([A-Za-z0-9_]+\.test)'/g)].map((m) => m[1] || m[2]));
const EXCLUDED = new Set(['browserSmoke.test']);

const standalone = readdirSync(testDir)
  .filter((f) => f.endsWith('.test.ts'))
  .map((f) => f.replace(/\.ts$/, ''))
  .filter((name) => !importedBySuite.has(name) && !EXCLUDED.has(name))
  .sort();

const run = (label, args) => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', ...args], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', env: process.env, timeout: 300_000 });
  return { label, status: result.status ?? 1, output: `${result.stdout || ''}${result.stderr || ''}` };
};

const failures = [];
console.log(`Running integrated suite, then ${standalone.length} standalone test files...`);
const suite = spawnSync(process.execPath, ['--import', 'tsx', path.join(testDir, 'suite.ts')], { stdio: 'inherit', env: process.env });
if (suite.status !== 0) failures.push('suite.ts');

for (const name of standalone) {
  const result = run(name, [path.join(testDir, `${name}.ts`)]);
  if (result.status === 0) console.log(`  ✓ ${name}`);
  else {
    console.log(`  ✗ ${name} (exit ${result.status})`);
    console.log(result.output.split('\n').slice(-25).join('\n'));
    failures.push(name);
  }
}

if (failures.length) {
  console.error(`\nFAILED: ${failures.join(', ')}`);
  process.exit(1);
}
console.log(`\nAll tests passed (suite + ${standalone.length} standalone files).`);
