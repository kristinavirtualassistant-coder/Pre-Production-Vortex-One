import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('server binds to Cloud Run PORT when provided', () => {
  const source = fs.readFileSync(new URL('../../server.ts', import.meta.url), 'utf8');
  assert.match(source, /const PORT = Number\(process\.env\.PORT\) \|\| 3000;/);
});
