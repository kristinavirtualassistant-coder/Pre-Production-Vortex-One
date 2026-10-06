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


export async function archiveRingCentralRecording(input:{organizationId:string;callId:string;recordingUrl:string;contactName?:string}){
  const organizationId=String(input.organizationId||'').trim();
  const callId=String(input.callId||'').trim();
  const recordingUrl=String(input.recordingUrl||'').trim();
  if(!organizationId||!callId||!recordingUrl) throw new Error('Recording archive requires organizationId, callId, and recordingUrl');

  const url=new URL(recordingUrl);
  const allowedHosts=new Set(['media.ringcentral.com','platform.ringcentral.com']);
  if(url.protocol!=='https:'||!allowedHosts.has(url.hostname)||url.username||url.password) {
    throw new Error('Recording URL host is not an approved RingCentral media endpoint');
  }

  const {getPgPool}=await import('../db/db');
  const pool=getPgPool();
  if(!pool) throw new Error('PostgreSQL is required to archive call recordings');

  const existing=await pool.query(
    `SELECT id,storage_path FROM file_assets
     WHERE organization_id=$1 AND entity_type='call' AND entity_id=$2
       AND category='call_recording' AND status='ready'
       AND metadata->>'source_url'=$3
     LIMIT 1`,
    [organizationId,callId,recordingUrl],
  );
  if(existing.rowCount) return existing.rows[0];

  const {SDK}=await import('@ringcentral/sdk');
  const clientId=process.env.RINGCENTRAL_CLIENT_ID?.trim();
  const clientSecret=process.env.RINGCENTRAL_CLIENT_SECRET?.trim()||'';
  const jwt=process.env.RINGCENTRAL_JWT?.trim();
  if(!clientId||!jwt) throw new Error('RingCentral credentials are required to archive recordings');

  const sdk=new SDK({
    server:process.env.RINGCENTRAL_SERVER_URL?.trim()||process.env.RINGCENTRAL_SERVER?.trim()||'https://platform.ringcentral.com',
    clientId,
    clientSecret,
  });
  const platform=sdk.platform();
  await platform.login({jwt});
  const tokenData=await platform.auth().data();
  const accessToken=String(tokenData?.access_token||'');
  if(!accessToken) throw new Error('RingCentral authentication did not return an access token');

  const sourceResponse=await fetch(recordingUrl,{headers:{Authorization:`Bearer ${accessToken}`,Accept:'audio/*'}})
  if(!sourceResponse.ok||!sourceResponse.body) throw new Error(`RingCentral recording download failed (${sourceResponse.status})`);

  const contentType=(sourceResponse.headers.get('content-type')||'audio/mpeg').split(';')[0].trim();
  const contentLength=sourceResponse.headers.get('content-length');
  const sizeBytes=contentLength?Number(contentLength):0;
  if(sizeBytes>0) validateFileRequest({originalName:'call-recording.mp3',mimeType:contentType,sizeBytes,category:'call_recording'});

  const recordingId=url.pathname.split('/').filter(Boolean).pop()||'recording';
  const safeRecordingId=recordingId.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100)||'recording';
  const fileId=`file_callrec_${safeRecordingId}`;
  const extension=contentType.includes('wav')?'wav':contentType.includes('mp4')?'mp4':contentType.includes('ogg')?'ogg':'mp3';
  const storagePath=buildStoragePath(organizationId,'call',callId,fileId,`call-recording.${extension}`);
  const {url:storageBase,key}=config();
  const uploadHeaders=new Headers({
    Authorization:`Bearer ${key}`,
    apikey:key,
    'Content-Type':contentType,
    'x-upsert':'false',
  });
  if(contentLength) uploadHeaders.set('Content-Length',contentLength);
  const uploadResponse=await fetch(`${storageBase}/object/${getFileStorageBucket()}/${storagePath}`,{
    method:'POST',
    headers:uploadHeaders,
    body:sourceResponse.body as any,
    duplex:'half' as any,
  });
  if(!uploadResponse.ok){
    const body=await uploadResponse.text().catch(()=> '');
    throw new Error(`Private storage upload failed (${uploadResponse.status}): ${body.slice(0,300)}`);
  }

  const metadata={source:'ringcentral',source_url:recordingUrl,recording_id:recordingId,archived_at:new Date().toISOString()};
  const result=await pool.query(
    `INSERT INTO file_assets
      (id,organization_id,entity_type,entity_id,category,original_name,storage_bucket,storage_path,mime_type,size_bytes,metadata,status)
     VALUES ($1,$2,'call',$3,'call_recording',$4,$5,$6,$7,$8,$9::jsonb,'ready')
     ON CONFLICT (organization_id,storage_bucket,storage_path) DO UPDATE
       SET status='ready',mime_type=EXCLUDED.mime_type,size_bytes=EXCLUDED.size_bytes,metadata=EXCLUDED.metadata,updated_at=CURRENT_TIMESTAMP,deleted_at=NULL
     RETURNING id,storage_path,status`,
    [fileId,organizationId,callId,`call-recording-${safeRecordingId}.${extension}`,getFileStorageBucket(),storagePath,contentType,sizeBytes||0,JSON.stringify(metadata)],
  );
  return result.rows[0];
}
