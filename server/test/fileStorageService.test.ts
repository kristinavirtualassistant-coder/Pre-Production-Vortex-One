import assert from 'node:assert/strict';
import { buildStoragePath, validateFileRequest } from '../services/fileStorageService';
assert.equal(buildStoragePath('org_a','property','prop_1','file_123','Tax Bill 2026.pdf'),'org_a/property/prop_1/file_123.pdf');
assert.throws(()=>validateFileRequest({originalName:'payload.exe',mimeType:'application/octet-stream',sizeBytes:100,category:'property_document'}),/not allowed/);
assert.throws(()=>validateFileRequest({originalName:'document.pdf',mimeType:'application/pdf',sizeBytes:100,category:'invalid'}),/Invalid file category/);
console.log('Files & Documents security tests passed');
