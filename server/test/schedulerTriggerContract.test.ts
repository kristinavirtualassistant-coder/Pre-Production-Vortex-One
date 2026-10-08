import assert from 'node:assert/strict';
import fs from 'node:fs';

const tick = fs.readFileSync('server/workers/tick.ts', 'utf8');
const runner = fs.readFileSync('server/workers/run.ts', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const propertyWorker = fs.readFileSync('server/workers/schedulerWorker.ts', 'utf8');
const workflowService = fs.readFileSync('server/services/workflowAutomationService.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');

// One worker process runs every background unit; claims are PostgreSQL-backed so several workers can run safely.
assert.match(tick, /runPropertyRefreshWorkerOnce/);
assert.match(tick, /runEmailWorkerOnce/);
assert.match(tick, /claimDueWorkflowSchedules/);
assert.match(tick, /runWorkflowWorkerOnce/);
assert.match(tick, /runFileProcessingWorkerOnce/);
assert.match(tick, /purgeExpiredSessions/);
assert.match(runner, /SIGTERM/);
assert.match(runner, /initializeDatabase/);
assert.equal(pkg.scripts.worker, 'tsx server/workers/run.ts');
assert.match(pkg.scripts.build, /dist\/worker\.cjs/);
assert.equal(pkg.scripts['start:worker'], 'node dist/worker.cjs');
// The HTTP trigger remains an alternative and is machine-authenticated only.
assert.match(server, /\/internal\/scheduler\/workflows', requireSchedulerSecret/);
assert.match(propertyWorker, /claimNextJob/);
assert.match(propertyWorker, /completeJob/);
assert.match(propertyWorker, /failJob/);
assert.match(workflowService, /export async function runWorkflowWorkerOnce/);
// No GCP/Firebase deployment surface remains.
for (const gone of ['firebase.json', '.firebaserc', 'functions', 'firebase-worker.ts', 'netlify.toml']) {
  assert.equal(fs.existsSync(gone), false, `${gone} must not exist`);
}
console.log('Worker and scheduler contract tests passed');
