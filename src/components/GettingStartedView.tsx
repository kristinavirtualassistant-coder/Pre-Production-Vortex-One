import React, { useEffect, useState } from 'react';
import {
  Building2,
  Upload,
  Search,
  PhoneCall,
  Webhook,
  CheckCircle2,
  Circle,
  Lock,
  ArrowRight,
  Users,
  Map,
  Megaphone,
  Info,
  X,
} from 'lucide-react';
import { DataImportModal } from './DataImportModal';
import { useAuth } from '../contexts/AuthContext';

export interface SetupProgress {
  orgConfirmed: boolean;
  listImported: boolean;
  callerVerified: boolean;
  webhooksLinked: boolean;
}

/** Outreach (batch jobs, automated dialing) unlocks only after data exists and calling works. */
export const isOutreachUnlocked = (p: SetupProgress) => p.listImported && p.callerVerified;

const orgConfirmedKey = (orgId: string) => `vortex_org_profile_confirmed:${orgId}`;
const welcomeSeenKey = (orgId: string) => `vortex_welcome_seen:${orgId}`;

const safeGet = (key: string) => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const safeSet = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch { /* storage blocked: state lasts for this session only */ }
};

export const readOrgConfirmed = (orgId?: string) => Boolean(orgId && safeGet(orgConfirmedKey(orgId)));

interface GettingStartedViewProps {
  progress: SetupProgress;
  organizationId?: string;
  organizationName?: string;
  onNavigate: (view: string) => void;
  onOrgConfirmed: () => void;
  onDataImported: () => void;
}

const Hint: React.FC<{ text: string }> = ({ text }) => (
  <span className="relative group inline-flex align-middle ml-1">
    <Info className="w-3.5 h-3.5 text-slate-400" aria-label={text} />
    <span role="tooltip" className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-64 rounded-lg bg-slate-900 text-white text-[11px] leading-snug p-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition z-20">
      {text}
    </span>
  </span>
);

export const WelcomeModal: React.FC<{ organizationId?: string; onStart: () => void }> = ({ organizationId, onStart }) => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (organizationId && !safeGet(welcomeSeenKey(organizationId))) setOpen(true);
  }, [organizationId]);
  if (!open || !organizationId) return null;

  const close = () => {
    safeSet(welcomeSeenKey(organizationId), '1');
    setOpen(false);
  };

  const steps = [
    { icon: Building2, title: 'Set up your workspace', body: 'Confirm your organization profile so data and teammates stay in your own tenant.' },
    { icon: Upload, title: 'Bring in property owners', body: 'Upload your master call list CSV or run a first property search to enrich parcels.' },
    { icon: PhoneCall, title: 'Connect calling and CRM', body: 'Verify your caller setup and link CRM webhooks so outcomes flow back.' },
    { icon: Megaphone, title: 'Automate outreach', body: 'Batch jobs and automated dialing unlock once your list and caller are ready.' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl p-6">
        <div className="flex items-start justify-between">
          <h2 id="welcome-title" className="text-xl font-bold text-slate-900">Welcome to Vortex One</h2>
          <button onClick={close} className="p-1 rounded hover:bg-slate-100" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-slate-600 mt-1">Vortex One enriches property parcels with owner data, then automates compliant outreach. Setup works best in this order:</p>
        <ol className="mt-4 space-y-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="flex-none w-7 h-7 rounded-full bg-cyan-50 text-cyan-700 flex items-center justify-center text-xs font-bold">{i + 1}</span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{s.title}</p>
                <p className="text-xs text-slate-500">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <button onClick={() => { close(); onStart(); }} className="mt-6 w-full rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold py-2.5 inline-flex items-center justify-center gap-2">
          Start setup <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export const GettingStartedView: React.FC<GettingStartedViewProps> = ({
  progress,
  organizationId,
  organizationName,
  onNavigate,
  onOrgConfirmed,
  onDataImported,
}) => {
  const [importOpen, setImportOpen] = useState(false);

  const confirmOrg = () => {
    if (organizationId) safeSet(orgConfirmedKey(organizationId), '1');
    onOrgConfirmed();
  };

  const integrationSteps = [
    { done: progress.callerVerified, label: 'Verify your caller setup', detail: 'Add telephony keys and place one test call from the dialer.', icon: PhoneCall, action: () => onNavigate('dialer'), cta: 'Open dialer' },
    { done: progress.webhooksLinked, label: 'Link CRM webhooks', detail: 'Send call outcomes and lead updates to your CRM.', icon: Webhook, action: () => onNavigate('integrations'), cta: 'Open integrations' },
  ];
  const checklist = [
    { done: progress.orgConfirmed, label: 'Organization profile' },
    { done: progress.listImported, label: 'First property owner list' },
    ...integrationSteps.map((s) => ({ done: s.done, label: s.label })),
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const nextIndex = checklist.findIndex((c) => !c.done);
  const unlocked = isOutreachUnlocked(progress);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <header className="bg-white border border-slate-200 rounded-2xl p-6">
        <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200">Getting started</span>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">Let's get your workspace ready</h1>
        <p className="text-sm text-slate-500 mt-1">
          {nextIndex === -1 ? 'Setup complete. Your dashboard will show live analytics.' : `Step ${nextIndex + 1} of ${checklist.length}: ${checklist[nextIndex].label}`}
        </p>
        <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={checklist.length} aria-valuenow={doneCount}>
          <div className="h-full bg-cyan-600 transition-all" style={{ width: `${(doneCount / checklist.length) * 100}%` }} />
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
          {checklist.map((c) => (
            <li key={c.label} className={`inline-flex items-center gap-1.5 text-xs ${c.done ? 'text-emerald-700' : 'text-slate-500'}`}>
              {c.done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />} {c.label}
            </li>
          ))}
        </ul>
      </header>

      {/* 1. Workspace */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2"><Building2 className="w-4 h-4 text-cyan-600" /> 1. Organization profile</h2>
        <p className="text-sm text-slate-500 mt-1">Your workspace is a separate tenant. Confirm its profile before you invite teammates.</p>
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm">
            <span className="text-slate-500">Organization: </span><span className="font-semibold text-slate-900">{organizationName || 'Unnamed organization'}</span>
          </div>
          <button onClick={() => onNavigate('settings')} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Edit in settings</button>
          {progress.orgConfirmed ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><CheckCircle2 className="w-4 h-4" /> Confirmed</span>
          ) : (
            <button onClick={confirmOrg} className="rounded-xl bg-cyan-600 hover:bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white">Looks right</button>
          )}
        </div>
        <button
          onClick={() => onNavigate('settings')}
          disabled={!progress.orgConfirmed}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-700 disabled:text-slate-400 disabled:cursor-not-allowed"
          title={progress.orgConfirmed ? undefined : 'Confirm your organization profile first'}
        >
          {progress.orgConfirmed ? <Users className="w-4 h-4" /> : <Lock className="w-4 h-4" />} Invite team members
        </button>
      </section>

      {/* 2. Data ingestion */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2"><Upload className="w-4 h-4 text-cyan-600" /> 2. Add your first property owners</h2>
        <p className="text-sm text-slate-500 mt-1">Your dashboard has no data yet. Start with either option.</p>
        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          <button onClick={() => setImportOpen(true)} className="text-left rounded-xl border-2 border-cyan-200 bg-cyan-50/50 hover:bg-cyan-50 p-4">
            <Upload className="w-5 h-5 text-cyan-700" />
            <p className="mt-2 text-sm font-bold text-slate-900">Upload master call list (CSV)
              <Hint text="Outbound prospecting: owners you already plan to contact. Rows become leads in your pipeline." />
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Map columns, preview, then import owners and properties.</p>
          </button>
          <button onClick={() => onNavigate('property_search')} className="text-left rounded-xl border-2 border-slate-200 hover:bg-slate-50 p-4">
            <Search className="w-5 h-5 text-cyan-700" />
            <p className="mt-2 text-sm font-bold text-slate-900">Run a first property search (ATTOM)
              <Hint text="Spatial and GIS lookup: finds and enriches parcels by area or criteria. Results are research data until you send them to the pipeline." />
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Search parcels by county, ZIP or map area.</p>
          </button>
        </div>
        {progress.listImported && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><CheckCircle2 className="w-4 h-4" /> Data imported</p>
        )}
      </section>

      {/* 3. Integrations */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2"><PhoneCall className="w-4 h-4 text-cyan-600" /> 3. Connect calling and CRM</h2>
        <ul className="mt-4 divide-y divide-slate-100">
          {integrationSteps.map((s) => (
            <li key={s.label} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <s.icon className="w-5 h-5 text-slate-500 flex-none" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">{s.label}</p>
                <p className="text-xs text-slate-500">{s.detail}</p>
              </div>
              {s.done ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><CheckCircle2 className="w-4 h-4" /> Done</span>
              ) : (
                <button onClick={s.action} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">{s.cta}</button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* 4. Locked advanced features */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2"><Megaphone className="w-4 h-4 text-cyan-600" /> 4. Automate outreach</h2>
        <p className="text-sm text-slate-500 mt-1">{unlocked ? 'Ready. Batch processing and automated outreach are available.' : 'Unlocks after you import a list and verify your caller setup.'}</p>
        <div className="mt-4 grid sm:grid-cols-3 gap-3">
          {[
            { label: 'Batch processing', view: 'research_queue', icon: Map },
            { label: 'Automated dialing', view: 'campaigns', icon: PhoneCall },
            { label: 'Outreach triggers', view: 'workflows', icon: Megaphone },
          ].map((f) => (
            <button
              key={f.label}
              disabled={!unlocked}
              onClick={() => onNavigate(f.view)}
              title={unlocked ? undefined : 'Import a list and verify your caller setup first'}
              className="rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700 inline-flex items-center gap-2 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              {unlocked ? <f.icon className="w-4 h-4" /> : <Lock className="w-4 h-4" />} {f.label}
            </button>
          ))}
        </div>
      </section>

      <DataImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => { setImportOpen(false); onDataImported(); }}
        defaultMode="all"
        title="Upload master call list"
        description="Import property owners from a CSV file."
      />
    </div>
  );
};

/** Loads whether the org has any CRM webhook endpoint. Missing permission or errors count as not linked. */
export const useWebhooksLinked = (organizationId?: string) => {
  const { getAuthHeaders } = useAuth();
  const [linked, setLinked] = useState(false);
  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    fetch('/api/webhooks', { headers: { ...getAuthHeaders(), 'x-organization-id': organizationId } })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.endpoints || [];
        if (!cancelled) setLinked(list.length > 0);
      })
      .catch(() => { if (!cancelled) setLinked(false); });
    return () => { cancelled = true; };
  }, [organizationId, getAuthHeaders]);
  return linked;
};
