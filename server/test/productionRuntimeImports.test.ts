import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// The production image installs only `dependencies` (npm ci --omit=dev). Anything the runtime entrypoints load at start-up
// must therefore not statically import a devDependency such as vite.
const pkg = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
const devOnly = ['vite', 'tsx', 'esbuild', 'puppeteer'].filter((name) => pkg.devDependencies?.[name] && !pkg.dependencies?.[name]);

for (const file of ['server.ts', 'server-bootstrap.ts', 'server/workers/run.ts']) {
  const source = readFileSync(path.join(process.cwd(), file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const name of devOnly) {
    assert.ok(!new RegExp(`^\\s*import[^;]*from\\s+['"]${name}['"]`, 'm').test(source), `${file} must not statically import devDependency "${name}"`);
  }
}
assert.ok(devOnly.includes('vite'), 'vite is a devDependency, so it must only be loaded lazily in development');
console.log('productionRuntimeImports.test passed');
