import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive, Download, File, FileAudio, FileImage, FileText, FileUp, FolderOpen,
  Search, Trash2, UploadCloud, X, RefreshCw, ExternalLink
} from 'lucide-react';

type FileAsset = {
  id:string; organization_id:string; entity_type:string|null; entity_id:string|null;
  category:string; original_name:string; mime_type:string; size_bytes:number;
  checksum_sha256:string|null; description:string|null; metadata:Record<string,unknown>;
  status:string; uploaded_by:string|null; created_at:string; updated_at:string;
};

type Props = {
  getAuthHeaders: () => Record<string,string>;
  organizationId?: string;
  initialEntityType?: string;
  initialEntityId?: string;
};

const CATEGORIES = [
  ['','All files'],['property_document','Property documents'],['owner_document','Owner documents'],
  ['contract','Contracts'],['photo','Photos'],['call_recording','Call recordings'],
  ['call_transcript','Call transcripts'],['import','Imports'],['export','Exports'],['other','Other'],
] as const;

function formatBytes(bytes:number) {
  if (!bytes) return '0 B';
  const units=['B','KB','MB','GB']; const i=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),units.length-1);
  return `${(bytes/Math.pow(1024,i)).toFixed(i ? 1 : 0)} ${units[i]}`;
}
function iconFor(mime:string) {
  if (mime.startsWith('image/')) return FileImage;
  if (mime.startsWith('audio/')) return FileAudio;
  if (mime.includes('pdf') || mime.includes('word') || mime.includes('text')) return FileText;
  return File;
}

export const FilesDocumentsView: React.FC<Props> = ({
  getAuthHeaders, organizationId, initialEntityType, initialEntityId
}) => {
  const [files,setFiles]=useState<FileAsset[]>([]);
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('');
  const [loading,setLoading]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [error,setError]=useState('');
  const [dragging,setDragging]=useState(false);
  const [selected,setSelected]=useState<FileAsset|null>(null);
  const inputRef=useRef<HTMLInputElement>(null);

  const headers=useMemo(()=>getAuthHeaders(),[getAuthHeaders]);

  const load=useCallback(async()=>{
    setLoading(true); setError('');
    try {
      const params=new URLSearchParams();
      if(query)params.set('q',query);
      if(category)params.set('category',category);
      if(initialEntityType)params.set('entityType',initialEntityType);
      if(initialEntityId)params.set('entityId',initialEntityId);
      params.set('limit','100');
      const res=await fetch(`/api/files?${params}`,{headers});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.error||`Files request failed (HTTP ${res.status})`);
      setFiles(data.files||[]);
    } catch(e:any) { setError(e.message||'Unable to load files'); }
    finally { setLoading(false); }
  },[headers,query,category,initialEntityType,initialEntityId]);

  useEffect(()=>{ void load(); },[load]);

  const uploadOne=useCallback(async(file:File)=>{
    const res=await fetch('/api/files/upload-url',{
      method:'POST',headers:{'Content-Type':'application/json',...headers},
      body:JSON.stringify({
        originalName:file.name,mimeType:file.type||'application/octet-stream',sizeBytes:file.size,
        category:category||'other',entityType:initialEntityType||null,entityId:initialEntityId||null,
      })
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||`Upload preparation failed (HTTP ${res.status})`);
    const put=await fetch(data.signedUploadUrl,{method:'PUT',headers:{'Content-Type':file.type||'application/octet-stream'},body:file});
    if(!put.ok)throw new Error(`Storage upload failed (HTTP ${put.status})`);
    const finalize=await fetch(`/api/files/${encodeURIComponent(data.fileId)}/finalize`,{
      method:'POST',headers:{'Content-Type':'application/json',...headers},body:'{}'
    });
    const finalData=await finalize.json().catch(()=>({}));
    if(!finalize.ok)throw new Error(finalData.error||'File finalization failed');
  },[headers,category,initialEntityType,initialEntityId]);

  const upload=useCallback(async(list:FileList|File[])=>{
    const selectedFiles=Array.from(list); if(!selectedFiles.length)return;
    setUploading(true);setError('');
    try {
      for(const file of selectedFiles) await uploadOne(file);
      await load();
    } catch(e:any) { setError(e.message||'Upload failed'); }
    finally { setUploading(false); }
  },[uploadOne,load]);

  const download=useCallback(async(file:FileAsset)=>{
    const res=await fetch(`/api/files/${encodeURIComponent(file.id)}/download-url`,{headers});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||'Unable to create download URL');
    window.open(data.signedUrl,'_blank','noopener,noreferrer');
  },[headers]);

  const remove=useCallback(async(file:FileAsset)=>{
    if(!window.confirm(`Delete "${file.original_name}"? This removes the stored file.`))return;
    const res=await fetch(`/api/files/${encodeURIComponent(file.id)}`,{method:'DELETE',headers});
    if(!res.ok){const data=await res.json().catch(()=>({}));throw new Error(data.error||'Delete failed');}
    setSelected(null); await load();
  },[headers,load]);

  const onDrop=(e:React.DragEvent)=>{e.preventDefault();setDragging(false);void upload(e.dataTransfer.files);};

  return (
    <div className="h-full overflow-y-auto bg-slate-50/60">
      <div className="max-w-7xl mx-auto p-5 lg:p-7 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-cyan-700"/>
              <h1 className="text-xl font-extrabold text-slate-900">Files &amp; Documents</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">Private, tenant-scoped property, owner, call and workflow files.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>void load()} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <RefreshCw className={`w-3.5 h-3.5 inline mr-1.5 ${loading?'animate-spin':''}`}/>Refresh
            </button>
            <button onClick={()=>inputRef.current?.click()} disabled={uploading} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50">
              <UploadCloud className="w-3.5 h-3.5 inline mr-1.5"/>{uploading?'Uploading…':'Upload files'}
            </button>
            <input ref={inputRef} type="file" multiple className="hidden" onChange={e=>{if(e.target.files)void upload(e.target.files);e.currentTarget.value='';}} />
          </div>
        </div>

        <div
          onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={onDrop}
          className={`border-2 border-dashed rounded-2xl p-7 text-center transition ${dragging?'border-cyan-500 bg-cyan-50':'border-slate-200 bg-white'}`}
        >
          <FileUp className="w-7 h-7 mx-auto text-slate-400 mb-2"/>
          <p className="text-sm font-bold text-slate-700">{uploading?'Uploading files…':'Drop files here to upload'}</p>
          <p className="text-[11px] text-slate-400 mt-1">Documents, photos, contracts, recordings, transcripts and imports/exports</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search filename, description, OCR or transcript text…" className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-xs outline-none focus:border-cyan-400"/>
          </div>
          <select value={category} onChange={e=>setCategory(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white">
            {CATEGORIES.map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-800">{files.length} file{files.length===1?'':'s'}</span>
            {(initialEntityType||initialEntityId) && <span className="text-[10px] text-cyan-700 font-semibold">Entity-linked</span>}
          </div>
          {files.length===0 && !loading ? (
            <div className="p-12 text-center"><FolderOpen className="w-8 h-8 mx-auto text-slate-300"/><p className="text-sm font-semibold text-slate-500 mt-2">No files found</p></div>
          ) : (
            <div className="divide-y divide-slate-100">
              {files.map(file=>{
                const Icon=iconFor(file.mime_type);
                return <div key={file.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><Icon className="w-4 h-4 text-slate-500"/></div>
                  <button onClick={()=>setSelected(file)} className="min-w-0 flex-1 text-left">
                    <div className="text-xs font-bold text-slate-800 truncate">{file.original_name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{file.category.replaceAll('_',' ')} · {formatBytes(Number(file.size_bytes))} · {new Date(file.created_at).toLocaleString()}</div>
                  </button>
                  <button onClick={()=>void download(file).catch(e=>setError(e.message))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="Download"><Download className="w-4 h-4"/></button>
                  <button onClick={()=>void remove(file).catch(e=>setError(e.message))} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600" title="Delete"><Trash2 className="w-4 h-4"/></button>
                </div>
              })}
            </div>
          )}
        </div>
      </div>

      {selected && <div className="fixed inset-0 z-50 bg-slate-950/30 flex justify-end" onClick={()=>setSelected(null)}>
        <div className="w-full max-w-md bg-white h-full shadow-2xl p-5 overflow-y-auto" onClick={e=>e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-slate-900 text-sm">File details</h2>
            <button onClick={()=>setSelected(null)} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4"/></button>
          </div>
          <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-sm font-bold break-words">{selected.original_name}</div>
            <dl className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between gap-4"><dt className="text-slate-400">Type</dt><dd className="text-slate-700">{selected.mime_type}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-400">Size</dt><dd className="text-slate-700">{formatBytes(Number(selected.size_bytes))}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-400">Category</dt><dd className="text-slate-700">{selected.category.replaceAll('_',' ')}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-400">Entity</dt><dd className="text-slate-700">{selected.entity_type||'—'} / {selected.entity_id||'—'}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-400">Created</dt><dd className="text-slate-700">{new Date(selected.created_at).toLocaleString()}</dd></div>
            </dl>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={()=>void download(selected).catch(e=>setError(e.message))} className="flex-1 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold"><ExternalLink className="w-3.5 h-3.5 inline mr-1.5"/>Open</button>
            <button onClick={()=>void remove(selected).catch(e=>setError(e.message))} className="px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-bold"><Trash2 className="w-3.5 h-3.5 inline mr-1.5"/>Delete</button>
          </div>
        </div>
      </div>}
    </div>
  );
};
