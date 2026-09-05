import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';

const repoRoot = process.cwd();
const envExamplePath = join(repoRoot, '.env.example');

function isPlaceholder(value: string): boolean {
  const normalized = value.trim().replace(/^['"]|['"]$/g, '');
  return /^(?:$|your_|replace_|change_|example|placeholder|<.*>|\*+|REPLACE_ME)/i.test(normalized);
}

export function testEnvironmentExampleContainsNoLiveSecrets(): void {
  assert.equal(existsSync(envExamplePath), true, '.env.example must exist');
  const lines = readFileSync(envExamplePath, 'utf8').split(/\r?\n/);
  const sensitiveKeys = new Set([
    'RINGCENTRAL_CLIENT_ID', 'RINGCENTRAL_CLIENT_SECRET', 'RINGCENTRAL_USERNAME',
    'RINGCENTRAL_PASSWORD', 'RINGCENTRAL_JWT', 'RINGCENTRAL_WEBHOOK_VALIDATION_TOKEN',
    'RINGCENTRAL_FROM_NUMBER', 'GOOGLE_MAPS_API_KEY', 'VITE_GOOGLE_MAPS_API_KEY',
  ]);

  for (const line of lines) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || !sensitiveKeys.has(match[1])) continue;
    assert.equal(isPlaceholder(match[2]), true, `${match[1]} in .env.example must be a placeholder`);
  }
}

testEnvironmentExampleContainsNoLiveSecrets();
console.log('✓ PASS: .env.example contains no live credentials');

export function testDialerDoesNotFabricateSuccessfulCalls(): void {
  const serverSource = readFileSync(join(repoRoot, 'server.ts'), 'utf8');
  assert.match(
    serverSource,
    /if\s*\(\s*!telResult\?\.success[\s\S]*?\)\s*\{[\s\S]*?return res\.status\(502\)/,
    'dial endpoint must return failure when RingCentral initiation fails'
  );
}

testDialerDoesNotFabricateSuccessfulCalls();
console.log('✓ PASS: dialer does not fabricate successful calls after provider failure');
