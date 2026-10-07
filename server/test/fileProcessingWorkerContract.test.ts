import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync('server/workers/fileProcessingWorker.ts', 'utf8');
const firebaseWorker = fs.readFileSync('firebase-worker.ts', 'utf8');
const webhook = fs.readFileSync('server/dialer/webhookHandler.ts', 'utf8');
const storage = fs.readFileSync('server/services/fileStorageService.ts', 'utf8');
const filesRoute = fs.readFileSync('server/routes/files.ts', 'utf8');

assert.match(worker, /FOR UPDATE SKIP LOCKED/);
assert.match(worker, /status='processing'/);
assert.match(worker, /attempts = attempts \+ 1/);
assert.match(worker, /CURRENT_TIMESTAMP \+ \(\$5 \* INTERVAL '1 second'\)/);
assert.match(worker, /max_attempts/);
assert.match(worker, /archiveRingCentralRecording/);
assert.match(worker, /job\.job_type === 'document_extract'/);
assert.match(worker, /job\.job_type === 'transcript_extract'/);
assert.match(worker, /downloadStoredObject/);
assert.match(worker, /status='completed'/);
assert.match(firebaseWorker, /runFileProcessingWorkerOnce/);
assert.match(webhook, /getRingCentralRecordingFileId/);
assert.match(storage, /export function getRingCentralRecordingFileId/);
assert.match(filesRoute, /TEXT_EXTRACTION_MIMES/);
assert.match(filesRoute, /INSERT INTO file_processing_jobs/);
assert.match(filesRoute, /ON CONFLICT \(file_id,job_type\) DO UPDATE/);
assert.match(filesRoute, /document_extract/);
assert.match(filesRoute, /transcript_extract/);
console.log('File processing worker contract tests passed');
assert.match(worker, /extractDocumentText/);\nassert.match(filesRoute, /application\\/pdf/);\nassert.match(filesRoute, /application\\/vnd\\.openxmlformats-officedocument\\.wordprocessingml\\.document/);\nassert.match(filesRoute, /application\\/vnd\\.openxmlformats-officedocument\\.spreadsheetml\\.sheet/);\nassert.match(filesRoute, /application\\/vnd\\.openxmlformats-officedocument\\.presentationml\\.presentation/);\n