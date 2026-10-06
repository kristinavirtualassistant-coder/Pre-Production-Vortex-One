import React, { useEffect, useMemo, useState } from 'react';
import { Mail, MessageSquare, RefreshCw, Send, ShieldOff, Smartphone, Users, ChevronRight, Plus, X } from 'lucide-react';

type Props = {
  getAuthHeaders: () => Record<string,string>;
  organizationId?: string;
  selectedLeadId?: string;
};

type Thread = any;
type Message = any;
type Template = any;

/**
 * Combine authentication headers with the optional organization context header.
 */
const headersFor = (getAuthHeaders:Props['getAuthHeaders'], organizationId?:string) => ({
  ...getAuthHeaders(),
  ...(organizationId ? {'x-organization-id':organizationId} : {}),
});

/**
 * Render the organization inbox, message composer, sequences, and suppression registry.
 * Use the selected lead as the initial and post-send CRM link for composed messages.
 */
export const CommunicationsView: React.FC<Props> = ({getAuthHeaders,organizationId,selectedLeadId}) => {
  const [tab,setTab]=useState<'inbox'|'compose'|'sequences'|'suppression'>('inbox');
  const [channel,setChannel]=useState<'email'|'sms'>('email');
  const [threads,setThreads]=useState<Thread[]>([]);
  const [messages,setMessages]=useState<Message[]>([]);
  const [templates,setTemplates]=useState<Template[]>([]);
  const [suppressions,setSuppressions]=useState<any[]>([]);
  const [numbers,setNumbers]=useState<any[]>([]);
  const [sequences,setSequences]=useState<any[]>([]);
  const [selectedThread,setSelectedThread]=useState<string>('');
  const [to,setTo]=useState('');
  const [subject,setSubject]=useState('');
  const [body,setBody]=useState('');
  const [provider,setProvider]=useState<'google-workspace'|'microsoft-365'>('google-workspace');
  const [leadId,setLeadId]=useState(selectedLeadId || '');
  const [templateId,setTemplateId]=useState('');
  const [loading,setLoading]=useState(false);
  const [notice,setNotice]=useState('');

  /**
   * Fetch JSON with authentication and organization headers, throwing on HTTP errors.
   */
  const api=async (path:string, init:RequestInit={}) => {
    const response=await fetch(path,{...init,headers:{...headersFor(getAuthHeaders,organizationId),...(init.headers || {})}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  /**
   * Refresh channel threads and templates plus organization communication settings.
   * Keep successful responses when another request fails and show the first failure notice.
   */
  const load=async()=>{
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        api('/api/communications/threads?channel=' + channel),
        api('/api/communications/templates?channel=' + channel),
        api('/api/communications/suppressions'),
        api('/api/communications/numbers'),
        api('/api/communications/sequences'),
      ]);
      const [threadData,templateData,suppressionData,numberData,sequenceData]=results;
      if(threadData.status==='fulfilled') setThreads(threadData.value.threads || []);
      if(templateData.status==='fulfilled') setTemplates(templateData.value.templates || []);
      if(suppressionData.status==='fulfilled') setSuppressions(suppressionData.value.suppressions || []);
      if(numberData.status==='fulfilled') setNumbers(numberData.value.numbers || []);
      if(sequenceData.status==='fulfilled') setSequences(sequenceData.value.sequences || []);
      const failed=results.find((result)=>result.status==='rejected');
      if(failed && failed.status==='rejected') setNotice(failed.reason?.message || 'Some communications data could not be loaded.');
    } catch(e:any) { setNotice(e.message); }
    finally { setLoading(false); }
  };

  useEffect(()=>{ load(); },[channel,organizationId]);
  useEffect(()=>{ if(selectedLeadId) setLeadId(selectedLeadId); },[selectedLeadId]);

  /**
   * Select a conversation and load its messages, displaying a notice if loading fails.
   */
  const openThread=async(id:string)=>{
    setSelectedThread(id);
    try { const data=await api('/api/communications/threads/' + encodeURIComponent(id) + '/messages'); setMessages(data.messages || []); }
    catch(e:any){ setNotice(e.message); }
  };

  /**
   * Queue the composed email or SMS and, on success, clear the draft and refresh the inbox.
   * Display validation or request errors through the notice state.
   */
  const send=async()=>{
    if(!to.trim() || !body.trim()) { setNotice('Recipient and message are required.'); return; }
    setLoading(true);
    try {
      if(channel==='email') {
        await api('/api/communications/email/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider,to,subject,body,leadId:leadId || undefined})});
      } else {
        await api('/api/communications/sms/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to,body,leadId:leadId || undefined})});
      }
      setNotice(channel.toUpperCase() + ' queued successfully.');
      setBody(''); setSubject(''); setTo(''); setLeadId(selectedLeadId || '');
      setTab('inbox');
      await load();
    } catch(e:any) { setNotice(e.message); }
    finally { setLoading(false); }
  };

  /**
   * Import messages from the selected email provider and refresh the view with a count notice.
   */
  const syncEmail=async()=>{
    try { const data=await api('/api/communications/email/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider})}); setNotice('Imported ' + (data.imported || 0) + ' email messages.'); await load(); }
    catch(e:any){ setNotice(e.message); }
  };

  /**
   * Select a template and copy its subject and body into the composer when found.
   */
  const chooseTemplate=(id:string)=>{
    setTemplateId(id);
    const t=templates.find(x=>x.id===id);
    if(t){ setSubject(t.subject || ''); setBody(t.body || ''); }
  };

  const title=useMemo(()=>tab==='inbox'?'Unified Inbox':tab==='compose'?'Compose Message':tab==='sequences'?'Sequences':'Suppression & Compliance',[tab]);

  return (
    <div className="h-full min-h-0 flex flex-col bg-white">
      <div className="border-b border-slate-200 px-5 py-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-lg font-bold text-slate-900">Communications</h1>
          <p className="text-xs text-slate-500">Email + SMS attached to the same CRM relationship.</p>
        </div>
        <button onClick={()=>load()} className="p-2 border rounded-lg hover:bg-slate-50" title="Refresh"><RefreshCw className={'w-4 h-4 ' + (loading?'animate-spin':'')} /></button>
        <button onClick={()=>setTab('compose')} className="inline-flex items-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"><Plus className="w-4 h-4"/>Compose</button>
      </div>

      {notice && <div className="mx-5 mt-3 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-900 flex items-center gap-2"><span className="flex-1">{notice}</span><button onClick={()=>setNotice('')}><X className="w-4 h-4"/></button></div>}

      <div className="px-5 pt-3 flex gap-2 border-b border-slate-200">
        {[
          ['inbox','Inbox'],['compose','Compose'],['sequences','Sequences'],['suppression','Compliance']
        ].map(([id,label])=><button key={id} onClick={()=>setTab(id as any)} className={'px-3 py-2 text-xs font-semibold border-b-2 ' + (tab===id?'border-cyan-600 text-cyan-700':'border-transparent text-slate-500')}>{label}</button>)}
        <div className="ml-auto flex gap-1 pb-2">
          <button onClick={()=>setChannel('email')} className={'px-2 py-1 rounded-md text-[11px] ' + (channel==='email'?'bg-cyan-100 text-cyan-800':'bg-slate-100')}><Mail className="inline w-3 h-3 mr-1"/>Email</button>
          <button onClick={()=>setChannel('sms')} className={'px-2 py-1 rounded-md text-[11px] ' + (channel==='sms'?'bg-cyan-100 text-cyan-800':'bg-slate-100')}><MessageSquare className="inline w-3 h-3 mr-1"/>SMS</button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab==='inbox' && (
          <div className="h-full grid grid-cols-[minmax(260px,34%)_1fr]">
            <div className="border-r border-slate-200 overflow-y-auto">
              {threads.length===0 ? <div className="p-8 text-center text-xs text-slate-500">No {channel} conversations yet.</div> :
                threads.map(t=><button key={t.id} onClick={()=>openThread(t.id)} className={'w-full text-left p-4 border-b border-slate-100 hover:bg-slate-50 ' + (selectedThread===t.id?'bg-cyan-50':'')}>
                  <div className="flex items-center gap-2"><span className="font-semibold text-sm text-slate-800 truncate">{t.contact_key}</span><span className="ml-auto text-[10px] text-slate-400">{t.message_count} msgs</span></div>
                  <div className="text-xs text-slate-500 truncate mt-1">{t.subject || 'Conversation'}</div>
                  <div className="text-[10px] text-slate-400 mt-2">{t.provider} · {t.last_message_at ? new Date(t.last_message_at).toLocaleString() : ''}</div>
                </button>)}
            </div>
            <div className="overflow-y-auto p-5">
              {!selectedThread ? <div className="h-full flex items-center justify-center text-xs text-slate-400">Select a conversation.</div> :
                <div className="max-w-3xl mx-auto space-y-3">
                  {messages.map(m=><div key={m.id} className={'rounded-xl p-3 border ' + (m.direction==='outbound'?'bg-cyan-50 border-cyan-100 ml-12':'bg-slate-50 border-slate-200 mr-12')}>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-1"><span className="font-semibold">{m.direction==='outbound'?'You':m.from_address}</span><span>·</span><span>{new Date(m.created_at).toLocaleString()}</span><span className="ml-auto">{m.status}</span></div>
                    {m.subject && <div className="text-xs font-semibold text-slate-800 mb-1">{m.subject}</div>}
                    <div className="text-sm text-slate-700 whitespace-pre-wrap">{m.body}</div>
                  </div>)}
                </div>}
            </div>
          </div>
        )}

        {tab==='compose' && (
          <div className="max-w-3xl mx-auto p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-5"><div><h2 className="font-bold text-slate-900">{title}</h2><p className="text-xs text-slate-500 mt-1">Messages are linked to Lead → Owner → Property when a lead is supplied.</p></div><Send className="w-5 h-5 text-cyan-600"/></div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-600">Channel<select value={channel} onChange={e=>setChannel(e.target.value as any)} className="mt-1 w-full border rounded-lg p-2 text-sm"><option value="email">Email</option><option value="sms">SMS</option></select></label>
              {channel==='email' && <label className="text-xs font-semibold text-slate-600">Provider<select value={provider} onChange={e=>setProvider(e.target.value as any)} className="mt-1 w-full border rounded-lg p-2 text-sm"><option value="google-workspace">Gmail</option><option value="microsoft-365">Outlook</option></select></label>}
              <label className="text-xs font-semibold text-slate-600 col-span-2">Recipient<input value={to} onChange={e=>setTo(e.target.value)} placeholder={channel==='email'?'owner@example.com':'+15551234567'} className="mt-1 w-full border rounded-lg p-2 text-sm"/></label>
              <label className="text-xs font-semibold text-slate-600">Lead ID (optional)<input value={leadId} onChange={e=>setLeadId(e.target.value)} placeholder="lead_..." className="mt-1 w-full border rounded-lg p-2 text-sm"/></label>
              <label className="text-xs font-semibold text-slate-600">Template<select value={templateId} onChange={e=>chooseTemplate(e.target.value)} className="mt-1 w-full border rounded-lg p-2 text-sm"><option value="">No template</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
              {channel==='email' && <label className="text-xs font-semibold text-slate-600 col-span-2">Subject<input value={subject} onChange={e=>setSubject(e.target.value)} className="mt-1 w-full border rounded-lg p-2 text-sm"/></label>}
              <label className="text-xs font-semibold text-slate-600 col-span-2">Message<textarea value={body} onChange={e=>setBody(e.target.value)} rows={10} className="mt-1 w-full border rounded-lg p-3 text-sm resize-y" placeholder={channel==='sms'?'Keep SMS concise. STOP opt-out is automatically enforced.':'Write the email body. Tracking is added automatically.'}/></label>
            </div>
            <div className="mt-4 flex justify-end"><button disabled={loading} onClick={send} className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"><Send className="w-4 h-4"/>Queue {channel.toUpperCase()}</button></div>
          </div>
        )}

        {tab==='sequences' && (
          <div className="p-6 overflow-y-auto">
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-cyan-600"/><h2 className="font-bold">Sequences</h2></div>
                {sequences.length===0?<p className="text-xs text-slate-500">No sequences configured.</p>:sequences.map(s=><div key={s.id} className="border-b py-3 last:border-0"><div className="font-semibold text-sm">{s.name}</div><div className="text-xs text-slate-500">{s.status} · {s.enrollment_count} enrolled</div></div>)}
              </div>
              <div className="border rounded-xl p-5">
                <h2 className="font-bold mb-3">Messaging Numbers</h2>
                {numbers.length===0?<p className="text-xs text-slate-500">Connect Twilio and sync numbers to enable SMS.</p>:numbers.map(n=><div key={n.id || n.phone_number} className="flex items-center gap-2 py-2 border-b last:border-0"><Smartphone className="w-4 h-4 text-slate-400"/><span className="text-sm">{n.phone_number}</span><span className="text-xs text-slate-400 ml-auto">{n.friendly_name || 'Twilio'}</span></div>)}
              </div>
            </div>
          </div>
        )}

        {tab==='suppression' && (
          <div className="p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto border rounded-xl overflow-hidden">
              <div className="p-4 bg-slate-50 border-b flex items-center gap-2"><ShieldOff className="w-4 h-4 text-rose-600"/><div><h2 className="font-bold text-sm">Suppression / Opt-Out Registry</h2><p className="text-[11px] text-slate-500">Outbound email and SMS are blocked before dispatch.</p></div></div>
              {suppressions.length===0?<div className="p-8 text-center text-xs text-slate-500">No suppressions recorded.</div>:suppressions.map(s=><div key={s.id} className="p-3 border-b flex items-center gap-3 text-xs"><span className="font-semibold uppercase">{s.channel}</span><span>{s.contact_key}</span><span className="text-slate-400 ml-auto">{s.reason} · {s.source}</span></div>)}
            </div>
          </div>
        )}
      </div>

      {tab==='inbox' && <div className="border-t bg-slate-50 px-5 py-2 flex items-center gap-3 text-[11px] text-slate-500"><span>Provider sync:</span>{channel==='email' && <><button onClick={syncEmail} className="text-cyan-700 font-semibold hover:underline">Sync {provider==='google-workspace'?'Gmail':'Outlook'}</button><span>·</span></>}<span>SMS webhooks: Twilio</span><ChevronRight className="w-3 h-3"/><span>Templates: {templates.length}</span></div>}
    </div>
  );
};
