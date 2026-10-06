import { Router } from 'express';
import { getPgPool } from '../db/db';
import { type AuthRequest, requireRole } from '../middleware/auth';
import { requireOrganizationId } from '../services/organizationContext';
import { ALLOWED_CATEGORIES, buildStoragePath, createFileId, createSignedDownloadUrl, createSignedUploadUrl, ensureFileBucket, objectExists, removeStoredObject, validateFileRequest } from '../services/fileStorageService';

export function createFilesRouter(): Router {
  const router=Router();

  router.get('/',async(req:AuthRequest,res)=>{
    const pool=getPgPool(), org=requireOrganizationId(req.dbUser?.organization_id);
    if(!pool) return res.status(503).json({error:'Database unavailable'});
    const q=typeof req.query.q==='string'?req.query.q.trim():'';
    const category=typeof req.query.category==='string'?req.query.category:'';
    const entityType=typeof req.query.entityType==='string'?req.query.entityType:'';
    const entityId=typeof req.query.entityId==='string'?req.query.entityId:'';
    const limit=Math.min(Math.max(Number(req.query.limit||50),1),100), offset=Math.max(Number(req.query.offset||0),0);
    const values:unknown[]=[org], where=['organization_id=$1','deleted_at IS NULL','status=\'ready\''];
    if(category){if(!ALLOWED_CATEGORIES.has(category))return res.status(400).json({error:'Invalid category'});values.push(category);where.push(`category=$${values.length}`);}
    if(entityType){values.push(entityType.slice(0,50));where.push(`entity_type=$${values.length}`);}
    if(entityId){values.push(entityId.slice(0,64));where.push(`entity_id=$${values.length}`);}
    if(q){values.push(q);where.push(`to_tsvector('simple',coalesce(original_name,'')||' '||coalesce(description,'')||' '||coalesce(extracted_text,'')) @@ plainto_tsquery('simple',$${values.length})`);}
    values.push(limit,offset);
    const result=await pool.query(`SELECT id,organization_id,entity_type,entity_id,category,original_name,mime_type,size_bytes,checksum_sha256,description,metadata,status,uploaded_by,created_at,updated_at FROM file_assets WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT $${values.length-1} OFFSET $${values.length}`,values);
    return res.json({files:result.rows,limit,offset});
  });

  router.post('/upload-url',async(req:AuthRequest,res)=>{
    const pool=getPgPool(), org=requireOrganizationId(req.dbUser?.organization_id), userId=req.dbUser?.id;
    if(!pool||!userId)return res.status(503).json({error:'Database unavailable'});
    const b=req.body||{}, originalName=String(b.originalName||'').trim(), mimeType=String(b.mimeType||'').trim().toLowerCase();
    const sizeBytes=Number(b.sizeBytes), category=String(b.category||'').trim();
    const entityType=b.entityType==null?null:String(b.entityType).trim().slice(0,50), entityId=b.entityId==null?null:String(b.entityId).trim().slice(0,64);
    const description=b.description==null?null:String(b.description).slice(0,2000);
    try{
      validateFileRequest({originalName,mimeType,sizeBytes,category}); await ensureFileBucket();
      const fileId=createFileId(), bucket=process.env.VORTEX_FILES_BUCKET||'vortex-files', path=buildStoragePath(org,entityType,entityId,fileId,originalName);
      const {signedUrl,token}=await createSignedUploadUrl(path);
      await pool.query(`INSERT INTO file_assets(id,organization_id,entity_type,entity_id,category,original_name,storage_bucket,storage_path,mime_type,size_bytes,description,metadata,status,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending',$13)`,[fileId,org,entityType,entityId,category,originalName,bucket,path,mimeType,sizeBytes,description,JSON.stringify(b.metadata||{}),userId]);
      return res.status(201).json({fileId,bucket,path,signedUploadUrl:signedUrl,token,expiresInSeconds:Number(process.env.VORTEX_FILES_UPLOAD_EXPIRY_SECONDS||7200)});
    }catch(error:any){return res.status(400).json({error:error.message||'Unable to prepare upload'});}
  });

  router.post('/:id/finalize',async(req:AuthRequest,res)=>{
    const pool=getPgPool(),org=requireOrganizationId(req.dbUser?.organization_id);if(!pool)return res.status(503).json({error:'Database unavailable'});
    const id=String(req.params.id||''), existing=await pool.query('SELECT * FROM file_assets WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL LIMIT 1',[id,org]);
    if(!existing.rows[0])return res.status(404).json({error:'File not found'});
    try{
      if(!(await objectExists(existing.rows[0].storage_path)))return res.status(409).json({error:'Upload has not completed'});
      const result=await pool.query(`UPDATE file_assets SET status='ready',checksum_sha256=COALESCE($3,checksum_sha256),metadata=metadata||$2::jsonb,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND organization_id=$4 AND status='pending' RETURNING id,organization_id,entity_type,entity_id,category,original_name,mime_type,size_bytes,checksum_sha256,description,metadata,status,uploaded_by,created_at,updated_at`,[id,JSON.stringify(req.body?.metadata||{}),req.body?.checksumSha256||null,org]);
      return res.json({file:result.rows[0]||existing.rows[0]});
    }catch(error:any){return res.status(502).json({error:error.message||'Unable to finalize upload'});}
  });

  router.get('/:id/download-url',async(req:AuthRequest,res)=>{
    const pool=getPgPool(),org=requireOrganizationId(req.dbUser?.organization_id);if(!pool)return res.status(503).json({error:'Database unavailable'});
    const result=await pool.query('SELECT id,original_name,mime_type,size_bytes,storage_path FROM file_assets WHERE id=$1 AND organization_id=$2 AND status=\'ready\' AND deleted_at IS NULL LIMIT 1',[String(req.params.id||''),org]);
    if(!result.rows[0])return res.status(404).json({error:'File not found'});
    try{return res.json({fileId:result.rows[0].id,fileName:result.rows[0].original_name,mimeType:result.rows[0].mime_type,sizeBytes:result.rows[0].size_bytes,signedUrl:await createSignedDownloadUrl(result.rows[0].storage_path),expiresInSeconds:Number(process.env.VORTEX_FILES_DOWNLOAD_EXPIRY_SECONDS||300)});}
    catch(error:any){return res.status(502).json({error:error.message||'Unable to create download URL'});}
  });

  router.delete('/:id',requireRole(['admin','executive','manager']),async(req:AuthRequest,res)=>{
    const pool=getPgPool(),org=requireOrganizationId(req.dbUser?.organization_id);if(!pool)return res.status(503).json({error:'Database unavailable'});
    const id=String(req.params.id||''),result=await pool.query('SELECT storage_path FROM file_assets WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL LIMIT 1',[id,org]);
    if(!result.rows[0])return res.status(404).json({error:'File not found'});
    try{await removeStoredObject(result.rows[0].storage_path);await pool.query(`UPDATE file_assets SET status='deleted',deleted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND organization_id=$2`,[id,org]);return res.status(204).send();}
    catch(error:any){return res.status(502).json({error:error.message||'Unable to delete file'});}
  });
  return router;
}
