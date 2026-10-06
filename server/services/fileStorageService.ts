import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const DEFAULT_BUCKET = 'vortex-files';
const DEFAULT_MAX_BYTES = 500 * 1024 * 1024;

export const ALLOWED_CATEGORIES = new Set([
  'property_document','owner_document','contract','photo','call_recording',
  'call_transcript','import','export','other',
]);
const SAFE_EXTENSIONS = new Set([
  'pdf','csv','txt','json','xml','zip','jpg','jpeg','png','webp','gif','heic',
  'mp3','wav','m4a','ogg','webm','mp4','mov','doc','docx','xls','xlsx','ppt','pptx',
]);

function client(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('File storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function getFileStorageBucket() { return process.env.VORTEX_FILES_BUCKET || DEFAULT_BUCKET; }

export function validateFileRequest(input: { originalName:string; mimeType:string; sizeBytes:number; category:string }) {
  const max = Number(process.env.VORTEX_FILES_MAX_BYTES || DEFAULT_MAX_BYTES);
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 0 || input.sizeBytes > max) throw new Error(`File size exceeds ${Math.floor(max/1024/1024)} MB`);
  if (!ALLOWED_CATEGORIES.has(input.category)) throw new Error('Invalid file category');
  if (!input.originalName || input.originalName.length > 512) throw new Error('Invalid file name');
  if (!input.mimeType || input.mimeType.length > 255) throw new Error('Invalid MIME type');
  const ext = input.originalName.toLowerCase().split('.').pop() || '';
  if (!SAFE_EXTENSIONS.has(ext)) throw new Error('File type is not allowed');
}
export function buildStoragePath(org:string, entityType:string|null, entityId:string|null, fileId:string, name:string) {
  const safe = (v:string) => v.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100) || 'unknown';
  const ext = name.includes('.') ? '.' + name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g,'') : '';
  return [safe(org),safe(entityType||'unlinked'),safe(entityId||'none'),fileId+ext].join('/');
}
export async function ensureFileBucket() {
  const c=client(), bucket=getFileStorageBucket();
  const {data,error}=await c.storage.listBuckets();
  if(error) throw new Error(`Unable to inspect storage buckets: ${error.message}`);
  if(data?.some(b=>b.id===bucket)) return;
  const {error:createError}=await c.storage.createBucket(bucket,{public:false,fileSizeLimit:Number(process.env.VORTEX_FILES_MAX_BYTES||DEFAULT_MAX_BYTES)});
  if(createError && !/already exists/i.test(createError.message)) throw new Error(`Unable to create private file bucket: ${createError.message}`);
}
export async function createSignedUploadUrl(path:string) {
  const {data,error}=await client().storage.from(getFileStorageBucket()).createSignedUploadUrl(path,{upsert:false});
  if(error || !data?.signedUrl || !data?.token) throw new Error(`Unable to create signed upload URL: ${error?.message||'storage error'}`);
  return {signedUrl:data.signedUrl,token:data.token};
}
export async function createSignedDownloadUrl(path:string) {
  const {data,error}=await client().storage.from(getFileStorageBucket()).createSignedUrl(path,Number(process.env.VORTEX_FILES_DOWNLOAD_EXPIRY_SECONDS||300));
  if(error || !data?.signedUrl) throw new Error(`Unable to create signed download URL: ${error?.message||'storage error'}`);
  return data.signedUrl;
}
export async function objectExists(path:string) {
  const parts=path.split('/'), folder=parts.slice(0,-1).join('/'), name=parts[parts.length-1];
  const {data,error}=await client().storage.from(getFileStorageBucket()).list(folder,{search:name,limit:10});
  if(error) throw new Error(`Unable to verify uploaded file: ${error.message}`);
  return Boolean(data?.some(item=>item.name===name));
}
export async function removeStoredObject(path:string) {
  const {error}=await client().storage.from(getFileStorageBucket()).remove([path]);
  if(error) throw new Error(`Unable to delete stored file: ${error.message}`);
}
export function createFileId(){ return `file_${randomUUID()}`; }
