import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');

assert.equal(source.includes("const filtered = (inMemoryStore.properties || []).filter"), false, 'GET /api/properties must not be memory-backed');
assert.equal(source.includes("const filtered = (inMemoryStore.leads || []).filter"), false, 'GET /api/leads must not be memory-backed');
assert.equal(source.includes("res.json(inMemoryStore.campaigns);"), false, 'GET /api/campaigns must not fall back to memory');
assert.equal(source.includes("console.warn('PostgreSQL fetch campaigns fallback:'"), false, 'GET /api/campaigns must fail closed on database errors');
assert.equal(source.includes("res.json(inMemoryStore.calls);"), false, 'GET /api/calls must not fall back to memory');
assert.equal(source.includes("{ id: 'evt_1', call_id: req.params.id"), false, 'GET /api/calls/:id/events must not synthesize events');

console.log('phase 4 production read-boundary checks passed');
