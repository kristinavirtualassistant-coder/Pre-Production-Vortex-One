import assert from 'node:assert/strict';
import { isBlockedHostname, isUnsafeAddress, resolveSafeTarget, safeHttpRequest, SsrfBlockedError } from '../services/ssrfGuard';

const unsafe = [
  '0.0.0.0', '10.1.2.3', '127.0.0.1', '127.255.255.254', '100.64.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.255',
  '192.0.0.1', '192.0.2.5', '192.168.1.1', '198.18.0.1', '198.51.100.7', '203.0.113.9', '224.0.0.1', '255.255.255.255',
  '::', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:8.8.8.8', '::127.0.0.1', '64:ff9b::7f00:1', 'fc00::1', 'fd12:3456::1',
  'fe80::1', 'fec0::1', 'ff02::1', '2001:db8::1', '2001::1', '2002:7f00:1::1', '2001:10::1', '100::1', 'not-an-ip', '999.1.1.1',
];
for (const a of unsafe) assert.equal(isUnsafeAddress(a), true, `${a} must be blocked`);
const safe = ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.15.0.1', '172.32.0.1', '2606:4700:4700::1111', '2a00:1450:4009:81f::200e'];
for (const a of safe) assert.equal(isUnsafeAddress(a), false, `${a} must be allowed`);

for (const h of ['localhost', 'a.localhost', 'db.internal', 'metadata.google.internal', 'x.local', 'printer.lan', 'LOCALHOST.']) assert.equal(isBlockedHostname(h), true, h);
assert.equal(isBlockedHostname('example.com'), false);

const rejects = async (url: string, resolver?: any) => assert.rejects(resolveSafeTarget(url, resolver), SsrfBlockedError, url);
await rejects('ftp://example.com/x');
await rejects('https://user:pw@example.com/x');
await rejects('http://127.0.0.1/x');
await rejects('http://[::1]/x');
await rejects('http://[::ffff:127.0.0.1]/x');
await rejects('http://169.254.169.254/latest/meta-data');
await rejects('http://2130706433/'); // decimal form is normalised by WHATWG URL to 127.0.0.1
await rejects('http://0x7f.1/');
await rejects('http://metadata.google.internal/');
await rejects('https://mixed.example.com/', async () => [{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.5', family: 4 }]);
await rejects('https://empty.example.com/', async () => []);

// DNS pinning: one resolution; the connection hook can only ever return the validated address, even if DNS flips.
let calls = 0;
const resolver = async () => { calls += 1; return calls === 1 ? [{ address: '93.184.216.34', family: 4 as const }] : [{ address: '127.0.0.1', family: 4 as const }]; };
let captured: any;
const res = await safeHttpRequest('https://hooks.example.com/path?x=1', {
  resolver, body: '{"a":1}', headers: { 'content-type': 'application/json' },
  transport: async (target, options, body) => { captured = { target, options, body }; return { ok: true, status: 200, body: 'ok', truncated: false }; },
});
assert.equal(res.status, 200);
assert.equal(calls, 1, 'hostname resolved exactly once');
assert.equal(captured.options.hostname, 'hooks.example.com', 'Host/SNI keep the original hostname');
assert.equal(captured.options.path, '/path?x=1');
assert.equal(captured.options.agent, false);
captured.options.lookup('hooks.example.com', {}, (_e: any, addr: string, fam: number) => { assert.equal(addr, '93.184.216.34'); assert.equal(fam, 4); });
captured.options.lookup('hooks.example.com', { all: true }, (_e: any, list: any[]) => { assert.deepEqual(list, [{ address: '93.184.216.34', family: 4 }]); });
assert.equal(captured.options.headers['content-length'], '7');

// Redirect responses are returned as-is (http.request never follows them) and are not treated as success.
const redirect = await safeHttpRequest('https://hooks.example.com/', {
  resolver: async () => [{ address: '93.184.216.34', family: 4 }],
  transport: async () => ({ ok: false, status: 302, body: '', truncated: false }),
});
assert.equal(redirect.ok, false);
assert.equal(redirect.status, 302);
console.log('SSRF guard tests passed.');
