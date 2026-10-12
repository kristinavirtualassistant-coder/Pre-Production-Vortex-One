import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, LifeBuoy, Plus, Search } from 'lucide-react';
import { OwnerApiError, ownerGet, ownerPost, qs } from '../api';
import { Badge, Card, EmptyState, ErrorState, Field, Loading, Modal, PageHeader, Stat, Table, Td, dangerButton, formatDate, formatNumber, inputClass, primaryButton, secondaryButton, statusTone, useOwnerData } from '../ui';

interface Org { id: string; name: string; slug: string; status: 'active' | 'suspended' | 'deactivated'; created_at: string; plan: string; user_count: number; active_user_count?: number; subscription_status?: string | null; status_reason?: string | null; billing_email?: string | null }
interface OrgUser { id: string; name: string; email: string; role: string; active: boolean; lastLoginAt: string | null; mfaEnabled: boolean }

export default function Organizations({ path, navigate, supportOrgId, onSessionChanged }: { path: string; navigate: (to: string) => void; supportOrgId?: string; onSessionChanged: () => void }) {
  const id = path.startsWith('/owner/organizations/') ? decodeURIComponent(path.slice('/owner/organizations/'.length)) : null;
  return id ? <OrganizationDetail id={id} navigate={navigate} supportActive={supportOrgId === id} onSessionChanged={onSessionChanged} /> : <OrganizationList navigate={navigate} />;
}

function OrganizationList({ navigate }: { navigate: (to: string) => void }) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDebounced(search), 250); return () => clearTimeout(t); }, [search]);
  const { data, error, loading, reload } = useOwnerData<{ total: number; organizations: Org[] }>(`/api/owner/organizations${qs({ search: debounced, status })}`);
  return (
    <>
      <PageHeader title="Organizations" subtitle="Customer organizations on the platform." action={<button className={primaryButton} onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden />New organization</button>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[16rem] flex-1"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" aria-hidden /><input aria-label="Search organizations" placeholder="Search by name, slug or id" value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputClass} pl-9`} /></div>
        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} w-44`}>
          <option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="deactivated">Deactivated</option>
        </select>
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : !data || data.organizations.length === 0 ? <EmptyState title="No organizations match" hint="Adjust the search or create a new organization." /> : (
        <Table caption="Organizations" headers={['Organization', 'Status', 'Plan', 'Users', 'Created', '']}>{data.organizations.map((o) => (
          <tr key={o.id} className="hover:bg-slate-900/60"><Td><p className="font-medium text-white">{o.name}</p><p className="text-xs text-slate-500">{o.id}</p></Td>
            <Td><Badge tone={statusTone(o.status)}>{o.status}</Badge></Td><Td>{o.plan}</Td><Td>{formatNumber(o.active_user_count)} / {formatNumber(o.user_count)}</Td><Td className="whitespace-nowrap text-xs text-slate-400">{formatDate(o.created_at)}</Td>
            <Td><button className={secondaryButton} onClick={() => navigate(`/owner/organizations/${encodeURIComponent(o.id)}`)} aria-label={`View ${o.name}`}>View</button></Td></tr>))}</Table>)}
      {creating && <CreateOrganization onClose={() => setCreating(false)} onCreated={(org) => { setCreating(false); navigate(`/owner/organizations/${encodeURIComponent(org.id)}`); }} />}
    </>
  );
}

function CreateOrganization({ onClose, onCreated }: { onClose: () => void; onCreated: (o: Org) => void }) {
  const [name, setName] = useState(''); const [billingEmail, setBillingEmail] = useState(''); const [adminEmail, setAdminEmail] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try { onCreated(await ownerPost<Org>('/api/owner/organizations', { name, billingEmail, adminEmail })); } catch (err) { setError(err instanceof OwnerApiError ? err.message : 'Could not create the organization.'); } finally { setBusy(false); }
  }
  return (
    <Modal title="New organization" onClose={onClose} footer={<><button className={secondaryButton} onClick={onClose} type="button">Cancel</button><button form="create-org" className={primaryButton} disabled={busy}>{busy ? 'Creating…' : 'Create organization'}</button></>}>
      <form id="create-org" onSubmit={submit} className="space-y-3">
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
        <Field label="Organization name">{(id) => <input id={id} required minLength={2} maxLength={255} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />}</Field>
        <Field label="Billing email (optional)">{(id) => <input id={id} type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} className={inputClass} />}</Field>
        <Field label="First administrator email (optional)" hint="Sends a 7-day invitation so the customer can set up their own account. Credentials are never created here.">{(id) => <input id={id} type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className={inputClass} />}</Field>
      </form>
    </Modal>
  );
}

type Dialog = null | 'suspend' | 'deactivate' | 'activate' | 'support';

function OrganizationDetail({ id, navigate, supportActive, onSessionChanged }: { id: string; navigate: (to: string) => void; supportActive: boolean; onSessionChanged: () => void }) {
  const org = useOwnerData<Org>(`/api/owner/organizations/${encodeURIComponent(id)}`);
  const users = useOwnerData<{ users: OrgUser[] }>(`/api/owner/organizations/${encodeURIComponent(id)}/users`);
  const usage = useOwnerData<{ plan: string; counts: Record<string, number>; metrics: Array<{ metric: string; used: number }> }>(`/api/owner/organizations/${encodeURIComponent(id)}/usage`);
  const activity = useOwnerData<{ customerActivity: Array<{ id: string; agent: string; action: string; status: string; created_at: string }>; ownerActions: Array<{ id: string; action: string; result: string; created_at: string }> }>(`/api/owner/organizations/${encodeURIComponent(id)}/activity`);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState(''); const [confirmName, setConfirmName] = useState(''); const [minutes, setMinutes] = useState(30);
  const [busy, setBusy] = useState(false); const [actionError, setActionError] = useState<string | null>(null);

  const close = () => { setDialog(null); setReason(''); setConfirmName(''); setActionError(null); };
  async function act(path: string, body: unknown, after?: () => void) {
    setBusy(true); setActionError(null);
    try { await ownerPost(path, body); close(); org.reload(); users.reload(); activity.reload(); after?.(); } catch (e) { setActionError(e instanceof OwnerApiError ? e.message : 'Action failed.'); } finally { setBusy(false); }
  }

  if (org.loading && !org.data) return <Loading />;
  if (org.error || !org.data) return <><button className={`${secondaryButton} mb-4`} onClick={() => navigate('/owner/organizations')}><ArrowLeft className="h-4 w-4" aria-hidden />Organizations</button><ErrorState message={org.error || 'Organization not found.'} onRetry={org.reload} /></>;
  const o = org.data;
  const base = `/api/owner/organizations/${encodeURIComponent(id)}`;
  return (
    <>
      <button className={`${secondaryButton} mb-4`} onClick={() => navigate('/owner/organizations')}><ArrowLeft className="h-4 w-4" aria-hidden />Organizations</button>
      <PageHeader title={o.name} subtitle={`${o.id} · created ${formatDate(o.created_at)}`} action={
        <div className="flex flex-wrap gap-2">
          {supportActive ? <Badge tone="amber">Support mode active</Badge> : <button className={secondaryButton} onClick={() => setDialog('support')}><LifeBuoy className="h-4 w-4" aria-hidden />Start support session</button>}
          {o.status === 'active' && <button className={secondaryButton} onClick={() => setDialog('suspend')}>Suspend</button>}
          {o.status !== 'active' && <button className={primaryButton} onClick={() => setDialog('activate')}>Activate</button>}
          {o.status !== 'deactivated' && <button className={dangerButton} onClick={() => setDialog('deactivate')}>Deactivate…</button>}
        </div>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Status" value={<Badge tone={statusTone(o.status)}>{o.status}</Badge>} hint={o.status_reason || undefined} />
        <Stat label="Plan" value={o.plan} hint={o.subscription_status || 'No subscription record'} />
        <Stat label="Users" value={formatNumber(o.user_count)} />
        <Stat label="Billing email" value={<span className="text-base">{o.billing_email || '—'}</span>} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Usage">
          {usage.loading && !usage.data ? <Loading /> : usage.error ? <ErrorState message={usage.error} onRetry={usage.reload} /> : usage.data && (
            <dl className="grid grid-cols-2 gap-3 text-sm">{Object.entries(usage.data.counts).map(([k, v]) => <div key={k}><dt className="text-xs uppercase text-slate-500">{k.replace(/_/g, ' ')}</dt><dd className="text-white tabular-nums">{formatNumber(Number(v))}</dd></div>)}
              {usage.data.metrics.map((m) => <div key={m.metric}><dt className="text-xs uppercase text-slate-500">{m.metric.replace(/_/g, ' ')} (month)</dt><dd className="text-white tabular-nums">{formatNumber(m.used)}</dd></div>)}</dl>)}
        </Card>
        <Card title="Activity">
          {activity.loading && !activity.data ? <Loading /> : activity.error ? <ErrorState message={activity.error} onRetry={activity.reload} /> : activity.data && (activity.data.customerActivity.length + activity.data.ownerActions.length === 0 ? <EmptyState title="No activity recorded" /> : (
            <ul className="max-h-72 space-y-1 overflow-auto text-sm">{[...activity.data.ownerActions.map((a) => ({ ...a, who: 'owner' })), ...activity.data.customerActivity.map((a) => ({ ...a, who: a.agent, result: a.status }))].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 40).map((a) => (
              <li key={a.id} className="flex justify-between gap-2"><span className="text-slate-300">{a.action} <span className="text-xs text-slate-500">· {a.who}</span></span><span className="whitespace-nowrap text-xs text-slate-500">{formatDate(a.created_at)}</span></li>))}</ul>))}
        </Card>
      </div>
      <Card title="Users" className="mt-4">
        {users.loading && !users.data ? <Loading /> : users.error ? <ErrorState message={users.error} onRetry={users.reload} /> : !users.data || users.data.users.length === 0 ? <EmptyState title="No users yet" hint="Invite a first administrator when creating the organization." /> : (
          <Table caption="Organization users" headers={['User', 'Role', 'Status', 'MFA', 'Last login']}>{users.data.users.map((u) => (
            <tr key={u.id}><Td><p className="text-white">{u.name}</p><p className="text-xs text-slate-500">{u.email}</p></Td><Td>{u.role}</Td><Td><Badge tone={u.active ? 'green' : 'red'}>{u.active ? 'active' : 'inactive'}</Badge></Td><Td>{u.mfaEnabled ? 'On' : 'Off'}</Td><Td className="text-xs text-slate-400">{formatDate(u.lastLoginAt)}</Td></tr>))}</Table>)}
      </Card>

      {dialog === 'suspend' && <ReasonDialog title={`Suspend ${o.name}?`} body="Users of this organization are signed out immediately and cannot sign in until it is activated again." confirmLabel="Suspend organization" danger reason={reason} setReason={setReason} busy={busy} error={actionError} onClose={close} onConfirm={() => act(`${base}/suspend`, { reason })} />}
      {dialog === 'activate' && <Modal title={`Activate ${o.name}?`} onClose={close} footer={<><button className={secondaryButton} onClick={close}>Cancel</button><button className={primaryButton} disabled={busy} onClick={() => act(`${base}/activate`, {})}>Activate</button></>}><p className="text-sm text-slate-300">Users will be able to sign in again.</p>{actionError && <p role="alert" className="text-sm text-rose-300">{actionError}</p>}</Modal>}
      {dialog === 'deactivate' && (
        <Modal title={`Deactivate ${o.name}?`} onClose={close} footer={<><button className={secondaryButton} onClick={close}>Cancel</button><button className={dangerButton} disabled={busy || confirmName !== o.name || reason.trim().length < 3} onClick={() => act(`${base}/deactivate`, { reason, confirmName })}>Deactivate organization</button></>}>
          <p className="text-sm text-slate-300">This is a soft delete: data is kept, all sessions are revoked, and nobody can sign in. It can be reversed by activating the organization.</p>
          <Field label="Reason">{(fid) => <input id={fid} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />}</Field>
          <Field label={`Type “${o.name}” to confirm`}>{(fid) => <input id={fid} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} className={inputClass} autoComplete="off" />}</Field>
          {actionError && <p role="alert" className="text-sm text-rose-300">{actionError}</p>}
        </Modal>)}
      {dialog === 'support' && (
        <Modal title="Start support session" onClose={close} footer={<><button className={secondaryButton} onClick={close}>Cancel</button><button className={primaryButton} disabled={busy || reason.trim().length < 10} onClick={() => act('/api/owner/support/start', { orgId: id, reason, minutes }, onSessionChanged)}>Start support mode</button></>}>
          <p className="text-sm text-slate-300">Support mode is explicit and time-limited. Banners show while active, access covers only this organization, and the start, data views and end are recorded in the audit log under your name.</p>
          <Field label="Reason (10+ characters)">{(fid) => <textarea id={fid} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />}</Field>
          <Field label="Duration (minutes, max 60)">{(fid) => <input id={fid} type="number" min={5} max={60} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className={inputClass} />}</Field>
          {actionError && <p role="alert" className="text-sm text-rose-300">{actionError}</p>}
        </Modal>)}
    </>
  );
}

function ReasonDialog({ title, body, confirmLabel, danger, reason, setReason, busy, error, onClose, onConfirm }: { title: string; body: string; confirmLabel: string; danger?: boolean; reason: string; setReason: (v: string) => void; busy: boolean; error: string | null; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal title={title} onClose={onClose} footer={<><button className={secondaryButton} onClick={onClose}>Cancel</button><button className={danger ? dangerButton : primaryButton} disabled={busy || reason.trim().length < 3} onClick={onConfirm}>{confirmLabel}</button></>}>
      <p className="text-sm text-slate-300">{body}</p>
      <Field label="Reason (recorded in the audit log)">{(id) => <input id={id} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />}</Field>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    </Modal>
  );
}

void ownerGet;
