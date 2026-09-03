import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PhoneCall, PhoneOff, Pause, Play, RefreshCw, ShieldCheck } from 'lucide-react';
import type { DialerCampaign, LeadRecord, CallRecord } from '../types';

interface Props {
  campaigns: DialerCampaign[];
  leads: LeadRecord[];
  calls: CallRecord[];
  getAuthHeaders: () => Record<string, string>;
  organizationId: string;
  onRefresh: () => Promise<void> | void;
}

type UiState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended' | 'failed';

type ActiveCall = CallRecord & {
  telephony_session_id?: string;
  ringcentral_ringout_id?: string | number;
  ringcentral_party_id?: string;
  answered_at?: string;
  ended_at?: string;
  notes?: string;
};

const dispositions = [
  ['interested', 'Interested'], ['not_interested', 'Not Interested'],
  ['call_back_later', 'Callback'], ['wrong_number', 'Wrong Number'],
  ['do_not_call', 'DNC'], ['left_voicemail', 'Voicemail'],
  ['no_answer', 'No Answer'], ['busy', 'Busy'],
  ['gatekeeper_block', 'Gatekeeper'], ['transferred', 'Transferred'],
] as const;

function stateFromCall(call?: ActiveCall | null): UiState {
  if (!call) return 'idle';
  if (call.status === 'ringing') return 'ringing';
  if (call.status === 'connected' || call.status === 'in-progress') return 'connected';
  if (call.status === 'completed' || call.status === 'voicemail' || call.status === 'no_answer' || call.status === 'busy') return 'ended';
  if (call.status === 'failed') return 'failed';
  return 'calling';
}

export const ProductionDialerView: React.FC<Props> = ({ campaigns, leads, calls, getAuthHeaders, organizationId, onRefresh }) => {
  const [selectedCampaignId, setSelectedCampaignId] = useState(campaigns[0]?.id || '');
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [uiState, setUiState] = useState<UiState>('idle');
  const [selectedDisposition, setSelectedDisposition] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [campaignPaused, setCampaignPaused] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const streamAbort = useRef<AbortController | null>(null);

  const selectedCampaign = useMemo(() => campaigns.find(c => c.id === selectedCampaignId), [campaigns, selectedCampaignId]);
  const activeLead = useMemo(() => activeCall?.lead_id ? leads.find(l => l.id === activeCall.lead_id) : undefined, [activeCall, leads]);

  useEffect(() => {
    if (!selectedCampaignId && campaigns[0]) setSelectedCampaignId(campaigns[0].id);
  }, [campaigns, selectedCampaignId]);

  const loadActiveCall = useCallback(async () => {
    if (!organizationId) return;
    const res = await fetch(`/api/dialer/active-call?organizationId=${encodeURIComponent(organizationId)}`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    setActiveCall(data.call || null);
    setUiState(stateFromCall(data.call));
    if (data.call?.created_at) setStartedAt(data.call.created_at);
  }, [organizationId, getAuthHeaders]);

  useEffect(() => {
    loadActiveCall().catch(() => undefined);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [loadActiveCall]);

  useEffect(() => {
    streamAbort.current?.abort();
    if (!organizationId) return;
    const controller = new AbortController();
    streamAbort.current = controller;
    const run = async () => {
      const response = await fetch(`/api/dialer/stream?organizationId=${encodeURIComponent(organizationId)}`, {
        headers: getAuthHeaders(), signal: controller.signal,
      });
      if (!response.ok || !response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!controller.signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n'); buffer = chunks.pop() || '';
        for (const chunk of chunks) {
          const data = chunk.split('\n').find(line => line.startsWith('data: '))?.slice(6);
          if (!data) continue;
          try { const event = JSON.parse(data); setActiveCall(event.call || null); setUiState(stateFromCall(event.call)); } catch { /* ignore malformed stream frames */ }
        }
      }
    };
    run().catch(() => undefined);
    return () => controller.abort();
  }, [organizationId, getAuthHeaders]);

  const dialNext = async () => {
    if (!selectedCampaignId || busy || campaignPaused) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${selectedCampaignId}/dial`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ organizationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to start call');
      await loadActiveCall(); await onRefresh();
    } finally { setBusy(false); }
  };

  const saveDisposition = async () => {
    if (!activeCall || !selectedDisposition || busy) return;
    if (selectedDisposition === 'call_back_later' && !followUpAt) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/calls/${activeCall.id}/disposition`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ disposition: selectedDisposition, followUpAt: followUpAt || undefined, note: notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to save disposition');
      setSelectedDisposition(''); setNotes(''); setFollowUpAt(''); setActiveCall(null); setUiState('idle');
      await onRefresh();
    } finally { setBusy(false); }
  };

  const endCall = async () => {
    if (!activeCall || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/calls/${activeCall.id}/end`, { method: 'POST', headers: { ...getAuthHeaders() } });
      if (!res.ok) throw new Error('Unable to end call');
      await loadActiveCall();
    } finally { setBusy(false); }
  };

  const elapsed = startedAt ? Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000)) : 0;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const statusLabel = { idle: 'READY', calling: 'CALLING', ringing: 'RINGING', connected: 'CONNECTED', ended: 'CALL ENDED', failed: 'FAILED' }[uiState];

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-xl font-bold text-slate-900">Outbound Dialer</h1><p className="text-xs text-slate-500">Production RingCentral calling workspace</p></div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /><span className="text-xs font-semibold text-emerald-700">DNC pre-check enforced</span>
            <button onClick={() => loadActiveCall()} className="p-2 rounded-lg border bg-white"><RefreshCw className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="bg-white border rounded-xl p-4 flex flex-wrap items-center gap-3">
          <select value={selectedCampaignId} onChange={e => setSelectedCampaignId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm min-w-[260px]">
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => setCampaignPaused(v => !v)} className="px-3 py-2 rounded-lg border text-sm font-semibold">{campaignPaused ? <><Play className="inline w-4 h-4 mr-1" />Resume</> : <><Pause className="inline w-4 h-4 mr-1" />Pause</>}</button>
          <button onClick={dialNext} disabled={!selectedCampaign || busy || campaignPaused || !!activeCall} className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-bold disabled:opacity-40"><PhoneCall className="inline w-4 h-4 mr-1" />{busy ? 'Working...' : 'Dial Next'}</button>
          {selectedCampaign && <span className="text-xs text-slate-500">{selectedCampaign.total_contacts - selectedCampaign.dialed_count} contacts remaining</span>}
        </div>
        <div className="grid lg:grid-cols-[1.2fr_.8fr] gap-4">
          <section className="bg-white border rounded-xl overflow-hidden">
            <div className="p-6 text-center border-b">
              <div className="text-xs font-bold tracking-widest text-slate-400">CURRENT CALL</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{activeCall?.contact_name || 'No active contact'}</div>
              <div className="text-sm text-slate-500">{activeCall?.phone_number || '—'}</div>
              <div className="text-sm text-slate-600 mt-2">{activeLead?.property_address || activeCall?.property_address || 'Property address unavailable'}</div>
              <div className="mt-5 text-3xl font-extrabold text-cyan-700">{statusLabel}</div>
              <div className="mt-1 font-mono text-xl text-slate-700">{mm}:{ss}</div>
              {activeCall && <button onClick={endCall} disabled={busy || uiState === 'ended'} className="mt-5 px-4 py-2 rounded-lg border border-red-200 text-red-700 text-sm font-semibold disabled:opacity-40"><PhoneOff className="inline w-4 h-4 mr-1" />End Call</button>}
            </div>
            <div className="p-5">
              <div className="text-xs font-bold tracking-wider text-slate-400 mb-3">DISPOSITION</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {dispositions.map(([value, label]) => <button key={value} disabled={!activeCall || busy} onClick={() => setSelectedDisposition(value)} className={`px-3 py-2.5 rounded-lg border text-xs font-semibold ${selectedDisposition === value ? 'border-cyan-500 bg-cyan-50 text-cyan-800' : 'bg-white text-slate-700'} disabled:opacity-40`}>{label}</button>)}
              </div>
              {selectedDisposition === 'call_back_later' && <input type="datetime-local" value={followUpAt} onChange={e => setFollowUpAt(e.target.value)} className="mt-3 w-full border rounded-lg px-3 py-2 text-sm" />}
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Call notes..." className="mt-3 w-full min-h-28 border rounded-lg p-3 text-sm" />
              <button onClick={saveDisposition} disabled={!activeCall || !selectedDisposition || busy || (selectedDisposition === 'call_back_later' && !followUpAt)} className="mt-3 w-full py-3 rounded-lg bg-slate-900 text-white text-sm font-bold disabled:opacity-40">SAVE & NEXT</button>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="bg-white border rounded-xl p-5">
              <div className="text-xs font-bold tracking-wider text-slate-400">CALL DETAILS</div>
              <dl className="mt-3 space-y-3 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Campaign</dt><dd className="font-semibold text-right">{selectedCampaign?.name || '—'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Property</dt><dd className="font-semibold text-right">{activeLead?.property_address || activeCall?.property_address || '—'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Lead score</dt><dd className="font-semibold">{activeLead?.lead_score ?? '—'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">RingOut ID</dt><dd className="font-mono text-xs">{activeCall?.ringcentral_ringout_id || '—'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Session</dt><dd className="font-mono text-xs truncate max-w-[180px]">{activeCall?.telephony_session_id || 'Waiting for RingCentral'}</dd></div>
              </dl>
            </div>
            <div className="bg-white border rounded-xl p-5">
              <div className="text-xs font-bold tracking-wider text-slate-400">RECENT CALLS</div>
              <div className="mt-3 space-y-2">{calls.slice(0, 6).map(call => <div key={call.id} className="flex justify-between text-xs border-b pb-2"><span className="truncate pr-3">{call.contact_name}</span><span className="font-semibold">{call.status}</span></div>)}</div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
