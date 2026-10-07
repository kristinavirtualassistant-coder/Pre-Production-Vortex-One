import React, { useEffect, useMemo, useState } from 'react';
import { AnalyticsValueEventRecorder } from './AnalyticsValueEventRecorder';
import {
  Activity, BarChart3, Building2, CalendarCheck, DollarSign, Download,
  PhoneCall, RefreshCw, Sparkles, Target, Users, Workflow,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

interface Props {
  getAuthHeaders: () => Record<string, string>;
  organizationId: string;
}

type AnalyticsPayload = {
  range: { start: string; end: string };
  overview: Record<string, number>;
  funnel: Array<{ stage: string; count: number }>;
  trend: Array<{ day: string; leads: number; calls: number; appointments: number; won: number }>;
  campaigns: Array<Record<string, any>>;
  agents: Array<Record<string, any>>;
  users: Array<Record<string, any>>;
  workflows: Array<Record<string, any>>;
  enrichment: Record<string, number>;
  ai: Array<Record<string, any>>;
  costs: Array<Record<string, any>>;
  roi: { revenueUsd: number; costUsd: number; roiPercent: number | null; status: string; note: string };
  value: Array<Record<string, any>>;
};

const money = (v: unknown) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (v: unknown) => `${Number(v || 0).toFixed(1)}%`;

export const ReportingAnalyticsView: React.FC<Props> = ({ getAuthHeaders, organizationId }) => {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tab, setTab] = useState<'overview'|'campaigns'|'people'|'workflows'|'ai'|'roi'>('overview');

  const load = async () => {
    if (!organizationId) return;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ startDate: new Date(startDate).toISOString(), endDate: new Date(`${endDate}T23:59:59`).toISOString() });
      const res = await fetch(`/api/analytics?${params}`, {
        headers: { ...getAuthHeaders(), 'x-organization-id': organizationId },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Analytics request failed (${res.status})`);
      setData(body);
    } catch (e: any) {
      setError(e?.message || 'Analytics unavailable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [organizationId, startDate, endDate]);

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ['metric','value'],
      ...Object.entries(data.overview),
      ['recorded_cost_usd', data.roi.costUsd],
      ['recorded_revenue_usd', data.roi.revenueUsd],
      ['roi_percent', data.roi.roiPercent ?? ''],
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `vortex-one-analytics-${startDate}-${endDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const topCampaigns = useMemo(() => (data?.campaigns || []).slice(0, 10), [data]);
  const topAgents = useMemo(() => (data?.agents || []).slice(0, 10), [data]);

  if (loading && !data) {
    return <div className="p-8 text-sm text-slate-500 flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Loading reporting analytics…</div>;
  }
  if (error && !data) {
    return <div className="p-6"><div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div></div>;
  }
  if (!data) return null;

  const o = data.overview;
  const cards = [
    ['Leads', o.leads, Users],
    ['Calls', o.calls, PhoneCall],
    ['Connected', o.connectedCalls, Activity],
    ['Appointments', o.appointments, CalendarCheck],
    ['Won Leads', o.wonLeads, Target],
    ['Properties Added', o.propertiesAdded, Building2],
    ['Property Value', money(o.propertyValueUsd), Building2],
    ['Property Equity', money(o.propertyEquityUsd), DollarSign],
    ['AI Requests', data.ai.reduce((s, x) => s + Number(x.requests || 0), 0), Sparkles],
    ['Recorded Cost', money(data.roi.costUsd), DollarSign],
  ] as const;

  return (
    <div className="p-6 max-w-[1500px] mx-auto space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center"><BarChart3 className="w-5 h-5" /></div>
            <h1 className="text-xl font-bold text-slate-900">Reporting &amp; Analytics</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">Server-side, tenant-scoped operational analytics. Costs and ROI use recorded events only.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white" />
          <span className="text-xs text-slate-400">to</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white" />
          <button onClick={load} className="p-2 border border-slate-300 rounded-lg bg-white hover:bg-slate-50" title="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <button onClick={exportCsv} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-slate-900 text-white"><Download className="w-3.5 h-3.5" /> CSV</button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {cards.map(([label, value, Icon]) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-3.5">
            <div className="flex justify-between text-[11px] text-slate-500"><span>{label}</span><Icon className="w-4 h-4 text-cyan-600" /></div>
            <div className="mt-2 text-xl font-bold font-mono text-slate-900">{typeof value === 'number' ? value.toLocaleString() : value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 overflow-x-auto bg-white border border-slate-200 rounded-xl p-1">
        {(['overview','campaigns','people','workflows','ai','roi'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap ${tab === t ? 'bg-cyan-50 text-cyan-800 border border-cyan-200' : 'text-slate-600 hover:bg-slate-50'}`}>
            {t === 'overview' ? 'Overview' : t === 'campaigns' ? 'Campaigns' : t === 'people' ? 'Agents & Users' : t === 'workflows' ? 'Workflows' : t === 'ai' ? 'AI Usage' : 'Cost & ROI'}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-4">Activity trend</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{fontSize:10}} />
                  <YAxis tick={{fontSize:10}} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="leads" name="Leads" strokeWidth={2} />
                  <Line type="monotone" dataKey="calls" name="Calls" strokeWidth={2} />
                  <Line type="monotone" dataKey="appointments" name="Appointments" strokeWidth={2} />
                  <Line type="monotone" dataKey="won" name="Won" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-4">Lead conversion funnel</h2>
            <div className="space-y-2.5">
              {data.funnel.map((row, i) => {
                const max = Math.max(...data.funnel.map(x => Number(x.count)), 1);
                return <div key={row.stage} className="grid grid-cols-[145px_1fr_60px] items-center gap-3 text-xs">
                  <span className="truncate text-slate-600">{row.stage}</span>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-cyan-500" style={{width: `${Math.max(3, Number(row.count)/max*100)}%`}} /></div>
                  <span className="font-mono text-right font-semibold">{Number(row.count).toLocaleString()}</span>
                </div>;
              })}
            </div>
            <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-100 text-xs">
              <div><span className="text-slate-500">Connection</span><div className="font-bold mt-1">{pct(o.connectionRate)}</div></div>
              <div><span className="text-slate-500">Appointment</span><div className="font-bold mt-1">{pct(o.appointmentRate)}</div></div>
              <div><span className="text-slate-500">Win</span><div className="font-bold mt-1">{pct(o.winRate)}</div></div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-4">Owner enrichment</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ['Owners created', data.enrichment.owners_created],
                ['Contacts created', data.enrichment.contacts_created],
                ['With phone', data.enrichment.contacts_with_phone],
                ['With email', data.enrichment.contacts_with_email],
              ].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-slate-50 border border-slate-100 p-3"><div className="text-[11px] text-slate-500">{label}</div><div className="text-lg font-bold mt-1">{Number(value || 0).toLocaleString()}</div></div>)}
            </div>
          </section>
        </div>
      )}

      {tab === 'campaigns' && (
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <h2 className="text-sm font-bold">Campaign performance</h2>
          <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={topCampaigns}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{fontSize:10}} interval={0} angle={-20} textAnchor="end" height={65}/><YAxis/><Tooltip/><Legend/>
            <Bar dataKey="dialed_count" name="Dialed" /><Bar dataKey="connected_count" name="Connected" /><Bar dataKey="converted_count" name="Converted" />
          </BarChart></ResponsiveContainer></div>
          <div className="overflow-auto"><table className="w-full text-xs"><thead><tr className="text-left text-slate-500 border-b">{['Campaign','Dialed','Connected','Converted','Talk min','Recorded cost'].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{topCampaigns.map(c=><tr key={c.id} className="border-b last:border-0"><td className="p-2 font-semibold">{c.name}</td><td className="p-2">{c.dialed_count}</td><td className="p-2">{c.connected_count}</td><td className="p-2">{c.converted_count}</td><td className="p-2">{(Number(c.talk_seconds||0)/60).toFixed(1)}</td><td className="p-2">{money(c.cost_usd)}</td></tr>)}</tbody></table></div>
        </section>
      )}

      {tab === 'people' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <section className="bg-white border border-slate-200 rounded-xl p-5"><h2 className="text-sm font-bold mb-4">Agent performance</h2><div className="overflow-auto"><table className="w-full text-xs"><thead><tr className="text-left text-slate-500 border-b">{['Agent','Calls','Connected','Interested','Won','Talk min'].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{topAgents.map(a=><tr key={String(a.agent_id)} className="border-b last:border-0"><td className="p-2 font-semibold">{a.agent_id || 'Unassigned'}</td><td className="p-2">{a.calls}</td><td className="p-2">{a.connected}</td><td className="p-2">{a.interested}</td><td className="p-2">{a.won_leads}</td><td className="p-2">{(Number(a.talk_seconds||0)/60).toFixed(1)}</td></tr>)}</tbody></table></div></section>
          <section className="bg-white border border-slate-200 rounded-xl p-5"><h2 className="text-sm font-bold mb-4">User performance</h2><div className="overflow-auto"><table className="w-full text-xs"><thead><tr className="text-left text-slate-500 border-b">{['User','Role','Sessions','Calls','Reached','Cost'].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{data.users.map(u=><tr key={u.id} className="border-b last:border-0"><td className="p-2 font-semibold">{u.name}</td><td className="p-2">{u.role}</td><td className="p-2">{u.sessions}</td><td className="p-2">{u.calls_placed}</td><td className="p-2">{u.contacts_reached}</td><td className="p-2">{money(u.cost_usd)}</td></tr>)}</tbody></table></div></section>
        </div>
      )}

      {tab === 'workflows' && (
        <section className="bg-white border border-slate-200 rounded-xl p-5"><h2 className="text-sm font-bold mb-4">Workflow execution</h2><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{['queued','running','completed','failed'].map(status => { const row=data.workflows.find(x=>x.status===status); return <div key={status} className="rounded-lg border border-slate-200 p-4"><div className="text-xs text-slate-500 capitalize">{status}</div><div className="text-2xl font-bold mt-1">{Number(row?.runs||0).toLocaleString()}</div><div className="text-[11px] text-slate-500 mt-1">{Number(row?.execution_time_ms||0).toLocaleString()} ms total</div></div>; })}</div></section>
      )}

      {tab === 'ai' && (
        <section className="bg-white border border-slate-200 rounded-xl p-5"><h2 className="text-sm font-bold mb-4">AI usage</h2><div className="overflow-auto"><table className="w-full text-xs"><thead><tr className="text-left text-slate-500 border-b">{['Provider','Model','Operation','Requests','Tokens','Cost','Avg latency','Failures'].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{data.ai.map((x,i)=><tr key={`${x.provider}-${x.model}-${i}`} className="border-b last:border-0"><td className="p-2">{x.provider}</td><td className="p-2">{x.model}</td><td className="p-2">{x.operation}</td><td className="p-2">{x.requests}</td><td className="p-2">{Number(x.tokens||0).toLocaleString()}</td><td className="p-2">{money(x.cost_usd)}</td><td className="p-2">{Number(x.avg_latency_ms||0).toFixed(0)} ms</td><td className="p-2">{Number(x.failed||0)}</td></tr>)}</tbody></table>{data.ai.length===0&&<p className="text-xs text-slate-500 py-6">No AI usage events have been recorded for this period.</p>}</div></section>
      )}

      {tab === 'roi' && (
        <div className="space-y-5">
          <AnalyticsValueEventRecorder getAuthHeaders={getAuthHeaders} organizationId={organizationId} onRecorded={load} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <section className="bg-white border border-slate-200 rounded-xl p-5"><div className="text-xs text-slate-500">Recorded revenue/value</div><div className="text-2xl font-bold mt-2">{money(data.roi.revenueUsd)}</div></section>
          <section className="bg-white border border-slate-200 rounded-xl p-5"><div className="text-xs text-slate-500">Recorded operating cost</div><div className="text-2xl font-bold mt-2">{money(data.roi.costUsd)}</div></section>
          <section className="bg-white border border-slate-200 rounded-xl p-5"><div className="text-xs text-slate-500">ROI</div><div className="text-2xl font-bold mt-2">{data.roi.roiPercent === null ? 'Not measurable yet' : pct(data.roi.roiPercent)}</div><p className="text-[11px] text-slate-500 mt-2">{data.roi.note}</p></section>
          <section className="md:col-span-3 bg-slate-50 border border-slate-200 rounded-xl p-5"><h2 className="text-sm font-bold">Cost breakdown</h2><div className="mt-3 overflow-auto"><table className="w-full text-xs"><thead><tr className="text-left text-slate-500 border-b"><th className="p-2">Category</th><th className="p-2">Provider</th><th className="p-2">Events</th><th className="p-2">Cost</th></tr></thead><tbody>{data.costs.map((x,i)=><tr key={`${x.category}-${x.provider}-${i}`} className="border-b"><td className="p-2">{x.category}</td><td className="p-2">{x.provider || '—'}</td><td className="p-2">{x.events}</td><td className="p-2">{money(x.cost_usd)}</td></tr>)}</tbody></table>{data.costs.length===0&&<p className="text-xs text-slate-500 py-5">No recorded cost events for this period. No estimated costs are shown.</p>}</div></section>
        </div>
      )}
    </div>
  );
};
