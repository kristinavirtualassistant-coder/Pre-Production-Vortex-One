import { strict as assert } from 'node:assert';
import { RingCentralTelephonyAdapter } from '../dialer/telephonyAdapter';

const original = {
  clientId: process.env.RINGCENTRAL_CLIENT_ID,
  clientSecret: process.env.RINGCENTRAL_CLIENT_SECRET,
  jwt: process.env.RINGCENTRAL_JWT,
  username: process.env.RINGCENTRAL_USERNAME,
  password: process.env.RINGCENTRAL_PASSWORD,
};

for (const key of Object.keys(original)) {
  delete process.env[`RINGCENTRAL_${key === 'clientId' ? 'CLIENT_ID' : key === 'clientSecret' ? 'CLIENT_SECRET' : key === 'jwt' ? 'JWT' : key === 'username' ? 'USERNAME' : 'PASSWORD'}`];
}

try {
  const adapter = new RingCentralTelephonyAdapter() as any;

  assert.equal(adapter.clientId, undefined, 'RingCentral adapter must not contain a hard-coded client ID');
  assert.equal(adapter.platform, undefined, 'RingCentral SDK must not initialize without environment credentials');

  const result = await adapter.initiateCall({
    organizationId: 'org_test',
    toNumber: '19495550182',
    contactName: 'Test Contact',
  });

  assert.equal(result.success, false);
  assert.match(result.error || '', /credentials not configured/i);
} finally {
  if (original.clientId !== undefined) process.env.RINGCENTRAL_CLIENT_ID = original.clientId;
  if (original.clientSecret !== undefined) process.env.RINGCENTRAL_CLIENT_SECRET = original.clientSecret;
  if (original.jwt !== undefined) process.env.RINGCENTRAL_JWT = original.jwt;
  if (original.username !== undefined) process.env.RINGCENTRAL_USERNAME = original.username;
  if (original.password !== undefined) process.env.RINGCENTRAL_PASSWORD = original.password;
}

console.log('✓ PASS: RingCentral authentication requires environment credentials');
