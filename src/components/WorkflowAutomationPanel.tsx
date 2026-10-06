import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, Clock3, History, Play, RefreshCw, ShieldCheck } from 'lucide-react';
import type { Workflow } from '../types';

type Props = { workflow: Workflow | null };

export const WorkflowAutomationPanel: React.FC<Props> = ({ workflow }) => {
  const [versions, setVersions] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [scheduleType, setScheduleType] = useState<'once'|'interval'|'cron'>('once');
  const [runAt, setRunAt] = useState('');
  const [intervalSeconds, setIntervalSeconds] = useState('3600');
  const [cronExpression, setCronExpression] = useState('0 9 * * *');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!workflow?.workflow_id) return;
    const [v, s, r] = await Promise.all([
      fetch(`/api/workflows/${workflow.workflow_id}/versions`),
      fetch(`/api/workflows/${workflow.workflow_id}/schedules`),
      fetch(`/api/workflow-runs?workflow_id=${workflow.workflow_id}&limit=20`),
    ]);
    if (v.ok) setVersions(await v.json());
    if (s.ok) setSchedules(await s.json());
    if (r.ok) setRuns(await r.json());
  }, [workflow?.workflow_id]);

  useEffect(() => { void load(); }, [load]);

  const createVersion = async (publish: boolean) => {
    if (!workflow) return;
    setBusy(true); setMessage('');
    try {
      const res = await fetch(`/api/workflows/${workflow.workflow_id}/versions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Version creation failed');
      setMessage(publish ? `Version ${data.version} published.` : `Draft version ${data.version} created.`);
      await load();
    } catch (e: any) { setMessage(e.message || 'Version creation failed'); }
    finally { setBusy(false); }
  };

  const publishVersion = async (versionId: string) => {
    setBusy(true); setMessage('');
    try {
      const res = await fetch(`/api/workflows/${workflow?.workflow_id}/versions/${versionId}/publish`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Publish failed');
      setMessage(`Version ${data.version} is now live.`);
      await load();
    } catch (e: any) { setMessage(e.message || 'Publish failed'); }
    finally { setBusy(false); }
  };

  const createSchedule = async () => {
    if (!workflow) return;
    setBusy(true); setMessage('');
    const payload: any = {
      name: `${workflow.name} — ${scheduleType}`,
      schedule_type: scheduleType,
      trigger_payload: {},
    };
    if (scheduleType === 'once') payload.run_at = new Date(runAt).toISOString();
    if (scheduleType === 'interval') payload.interval_seconds = Number(intervalSeconds);
    if (scheduleType === 'cron') { payload.cron_expression = cronExpression; payload.timezone = 'UTC'; }
    try {
      const res = await fetch(`/api/workflows/${workflow.workflow_id}/schedules`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Schedule creation failed');
      setMessage('Workflow schedule created.');
      await load();
    } catch (e: any) { setMessage(e.message || 'Schedule creation failed'); }
    finally { setBusy(false); }
  };

  const loadLogs = async (runId: string) => {
    setSelectedRunId(runId);
    const res = await fetch(`/api/workflow-runs/${runId}/logs`);
    setLogs(res.ok ? await res.json() : []);
  };

  if (!workflow) return null;

  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-cyan-600" />
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Durable Automation</h3>
            <p className="text-[10px] text-slate-500">Versions, schedules, execution history and logs</p>
          </div>
        </div>
        <button onClick={() => void load()} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" title="Refresh">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold">Versions</span><button disabled={busy} onClick={() => void createVersion(false)} className="text-[10px] font-semibold text-cyan-700">Create draft</button></div>
          {versions.length === 0 && <p className="text-[10px] text-slate-400">No versions yet.</p>}
          {versions.slice(0, 5).map(v => (
            <div key={v.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-2">
              <div><div className="text-[11px] font-semibold">v{v.version}</div><div className="text-[9px] uppercase text-slate-500">{v.status}</div></div>
              {v.status === 'draft' && <button disabled={busy} onClick={() => void publishVersion(v.id)} className="text-[10px] font-semibold text-emerald-700">Publish</button>}
              {v.status === 'published' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
            </div>
          ))}
          <button disabled={busy} onClick={() => void createVersion(true)} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-50">
            <ShieldCheck className="h-3.5 w-3.5" /> Snapshot & publish
          </button>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-semibold">Schedule</span>
          <select value={scheduleType} onChange={e => setScheduleType(e.target.value as any)} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs">
            <option value="once">Run once</option><option value="interval">Repeat interval</option><option value="cron">Cron (UTC)</option>
          </select>
          {scheduleType === 'once' && <input type="datetime-local" value={runAt} onChange={e => setRunAt(e.target.value)} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs" />}
          {scheduleType === 'interval' && <input type="number" min="60" value={intervalSeconds} onChange={e => setIntervalSeconds(e.target.value)} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs" placeholder="Seconds" />}
          {scheduleType === 'cron' && <input value={cronExpression} onChange={e => setCronExpression(e.target.value)} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs font-mono" placeholder="0 9 * * *" />}
          <button disabled={busy || (scheduleType === 'once' && !runAt)} onClick={() => void createSchedule()} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-[10px] font-semibold text-cyan-800 disabled:opacity-50">
            <Play className="h-3.5 w-3.5" /> Create schedule
          </button>
          <div className="max-h-28 space-y-1 overflow-auto">
            {schedules.slice(0, 6).map(s => <div key={s.id} className="rounded border border-slate-100 px-2 py-1.5 text-[9px]"><span className="font-semibold">{s.schedule_type}</span> · {s.status} · {s.next_run_at ? new Date(s.next_run_at).toLocaleString() : 'complete'}</div>)}
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-semibold">Execution history</span>
          <div className="max-h-44 space-y-1 overflow-auto">
            {runs.length === 0 && <p className="text-[10px] text-slate-400">No durable runs yet.</p>}
            {runs.map(r => <button key={r.id} onClick={() => void loadLogs(r.id)} className={`flex w-full items-center justify-between rounded-lg border p-2 text-left ${selectedRunId===r.id?'border-cyan-300 bg-cyan-50':'border-slate-100 bg-slate-50'}`}>
              <span><span className="block text-[10px] font-semibold">{r.status}</span><span className="text-[9px] text-slate-500">{new Date(r.created_at).toLocaleString()}</span></span>
              <Clock3 className="h-3.5 w-3.5 text-slate-400" />
            </button>)}
          </div>
          {selectedRunId && <div className="max-h-28 overflow-auto rounded-lg border border-slate-100 bg-slate-950 p-2 font-mono text-[9px] text-slate-200">{logs.map(l => <div key={l.id} className="mb-1"><span className="text-cyan-300">{l.event}</span> {l.message}</div>)}</div>}
        </div>
      </div>
      {message && <div className="border-t border-slate-100 px-4 py-2 text-[10px] font-medium text-slate-600">{message}</div>}
      <div className="hidden"><History /></div>
    </section>
  );
};
