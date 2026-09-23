import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const worker = fs.readFileSync('server/workers/schedulerWorker.ts', 'utf8');
const wrangler = fs.readFileSync('deploy/cloudflare-scheduler/wrangler.jsonc', 'utf8');
const trigger = fs.readFileSync('deploy/cloudflare-scheduler/src/index.ts', 'utf8');

assert.match(server, /app\.post\('\/internal\/scheduler\/property-refresh'/);
assert.match(server, /x-vortex-scheduler-secret/);
assert.match(server, /SCHEDULER_TRIGGER_SECRET/);
assert.match(server, /runPropertyRefreshWorkerOnce/);
assert.match(server, /processedJobs/);
assert.match(worker, /JOB_TYPES\.PROPERTY_REFRESH/);
assert.match(worker, /claimNextJob\([^\n]+JOB_TYPES\.PROPERTY_REFRESH/);
assert.match(worker, /completeJob\(/);
assert.match(worker, /failJob\(/);
assert.match(wrangler, /"crons": \["0 \* \* \* \*"\]/);
assert.match(trigger, /scheduled\(/);
assert.match(trigger, /VORTEX_ONE_API_URL/);
assert.match(trigger, /SCHEDULER_TRIGGER_SECRET/);
console.log('scheduler trigger contract tests passed');
