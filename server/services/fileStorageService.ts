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

function config() {
  const url = (process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL || '').replace(/\/$/,'');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('File storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  return { url: `${url}/storage/v1`, key };
}
async function storageRequest(path:string, init:RequestInit={}) {
  const {url,key}=config();
  const headers=new Headers(init.headers);
  headers.set('Authorization',`Bearer ${key}`);
  headers.set('apikey',key);
  if(init.body && !headers.has('content-type')) headers.set('content-type','application/json');
  const response=await fetch(`${url}${path}`,{...init,headers});
  const text=await response.text();
  let data:any=null; try{data=text?JSON.parse(text):null;}catch{data=text;}
  if(!response.ok) throw new Error(data?.message || data?.error || `Storage API request failed (${response.status})`);
  return data;
}
export function getFileStorageBucket(){return process.env.VORTEX_FILES_BUCKET||DEFAULT_BUCKET;}
export function validateFileRequest(input:{originalName:string;mimeType:string;sizeBytes:number;category:string}){
  const max=Number(process.env.VORTEX_FILES_MAX_BYTES||DEFAULT_MAX_BYTES);
  if(!Number.isSafeInteger(input.sizeBytes)||input.sizeBytes<0||input.sizeBytes>max)throw new Error(`File size exceeds ${Math.floor(max/1024/1024)} MB`);
  if(!ALLOWED_CATEGORIES.has(input.category))throw new Error('Invalid file category');
  if(!input.originalName||input.originalName.length>512)throw new Error('Invalid file name');
  if(!input.mimeType||input.mimeType.length>255)throw new Error('Invalid MIME type');
  const ext=input.originalName.toLowerCase().split('.').pop()||'';
  if(!SAFE_EXTENSIONS.has(ext))throw new Error('File type is not allowed');
}
export function buildStoragePath(org:string,entityType:string|null,entityId:string|null,fileId:string,name:string){
  const safe=(v:string)=>v.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100)||'unknown';
  const ext=name.includes('.')?'.'+name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g,''):'';
  return [safe(org),safe(entityType||'unlinked'),safe(entityId||'none'),fileId+ext].join('/');
}
export async function ensureFileBucket(){
  const bucket=getFileStorageBucket();
  const buckets=await storageRequest('/bucket');
  if(Array.isArray(buckets)&&buckets.some((b:any)=>b.id===bucket))return;
  try{await storageRequest('/bucket',{method:'POST',body:JSON.stringify({id:bucket,name:bucket,public:false})});}
  catch(error:any){if(!/already exists/i.test(error.message))throw new Error(`Unable to create private file bucket: ${error.message}`);}
}
export async function createSignedUploadUrl(path:string){
  const data=await storageRequest(`/object/upload/sign/${getFileStorageBucket()}/${path}`,{method:'POST',body:'{}'});
  const relative=String(data?.url||'');
  const {url}=config();
  const signedUrl=relative.startsWith('http')?relative:`${url}${relative}`;
  const token=new URL(signedUrl).searchParams.get('token');
  if(!token)throw new Error('Storage did not return a signed upload token');
  return {signedUrl,token};
}
export async function createSignedDownloadUrl(path:string){
  const data=await storageRequest(`/object/sign/${getFileStorageBucket()}/${path}`,{method:'POST',body:JSON.stringify({expiresIn:Number(process.env.VORTEX_FILES_DOWNLOAD_EXPIRY_SECONDS||300)})});
  const {url}=config();
  const relative=String(data?.signedURL||'');
  if(!relative)throw new Error('Storage did not return a signed download URL');
  return relative.startsWith('http')?relative:`${url}${relative}`;
}
export async function objectExists(path:string){
  const parts=path.split('/'),folder=parts.slice(0,-1).join('/'),name=parts[parts.length-1];
  const data=await storageRequest(`/object/list/${getFileStorageBucket()}`,{method:'POST',body:JSON.stringify({prefix:folder,limit:10,offset:0,search:name,sortBy:{column:'name',order:'asc'}})});
  return Array.isArray(data)&&data.some((item:any)=>item.name===name);
}
export async function removeStoredObject(path:string){
  await storageRequest(`/object/${getFileStorageBucket()}`,{method:'DELETE',body:JSON.stringify({prefixes:[path]})});
}
export function createFileId(){return `file_${randomUUID()}`;}
