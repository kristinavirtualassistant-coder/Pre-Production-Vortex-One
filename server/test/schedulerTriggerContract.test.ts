import assert from 'node:assert/strict';
import fs from 'node:fs';

const firebaseConfig = fs.readFileSync('firebase.json', 'utf8');
const functions = fs.readFileSync('functions/index.cjs', 'utf8');
const worker = fs.readFileSync('firebase-worker.ts', 'utf8');
const propertyWorker = fs.readFileSync('server/workers/schedulerWorker.ts', 'utf8');
const workflowService = fs.readFileSync('server/services/workflowAutomationService.ts', 'utf8');

assert.match(firebaseConfig, /"source": "functions"/);
assert.match(firebaseConfig, /"functionId": "api"/);
assert.match(firebaseConfig, /"region": "us-west1"/);
assert.match(firebaseConfig, /"pinTag": true/);
assert.match(functions, /exports\.api = onRequest/);
assert.match(functions, /exports\.workerTick = onSchedule/);
assert.match(functions, /every 1 minutes/);
assert.match(functions, /VORTEX_ONE_RUNTIME_CONFIG/);
assert.match(worker, /runPropertyRefreshWorkerOnce/);
assert.match(worker, /runEmailWorkerOnce/);
assert.match(worker, /claimDueWorkflowSchedules/);
assert.match(worker, /runWorkflowWorkerOnce/);
assert.match(propertyWorker, /claimNextJob/);
assert.match(propertyWorker, /completeJob/);
assert.match(propertyWorker, /failJob/);
assert.match(workflowService, /export async function runWorkflowWorkerOnce/);
console.log('Firebase scheduler contract tests passed');
