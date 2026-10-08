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
  // Provider initiation lives in CampaignManager.dialNextContact (server.ts only delegates to it).
  const managerSource = readFileSync(join(repoRoot, 'server/dialer/campaignManager.ts'), 'utf8');
  assert.match(managerSource, /const telephonyResult = await adapter\.initiateCall\(/, 'the call is initiated through the telephony adapter');
  assert.match(managerSource, /status: telephonyResult\.success \? 'initiated' : 'failed'/, 'a provider failure is recorded as a failed call, never as initiated');
  assert.match(managerSource, /telephonyResult\.success \? undefined : now/, 'a failed call is ended immediately');
  assert.match(managerSource, /telephonyResult\.success \? 'dialing' : 'failed'/, 'a failed initiation marks the queued contact failed, not dialing');
}

testDialerDoesNotFabricateSuccessfulCalls();
console.log('✓ PASS: dialer does not fabricate successful calls after provider failure');
