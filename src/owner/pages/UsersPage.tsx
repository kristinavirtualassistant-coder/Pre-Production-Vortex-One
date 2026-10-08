import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { OwnerApiError, ownerPost, ownerPut, qs } from '../api';
import { Badge, EmptyState, ErrorState, Loading, Modal, PageHeader, Table, Td, dangerButton, formatDate, inputClass, primaryButton, secondaryButton, useOwnerData } from '../ui';

interface U { id: string; name: string; email: string; role: string; organizationId: string; organizationName: string; organizationStatus: string; active: boolean; lastLoginAt: string | null; mfaEnabled: boolean; isPlatformOwner: boolean }
// The ONLY roles that can be assigned. Platform ownership is not a role and cannot be granted from the UI or the API.
const ROLES = ['admin', 'executive', 'manager', 'agent', 'member'];

type Pending = null | { kind: 'deactivate' | 'activate' | 'remove'; user: U } | { kind: 'role'; user: U; role: string };

export default function UsersPage() {
  const [search, setSearch] = useState(''); const [debounced, setDebounced] = useState(''); const [active, setActive] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebounced(search), 250); return () => clearTimeout(t); }, [search]);
  const { data, error, loading, reload } = useOwnerData<{ total: number; users: U[] }>(`/api/owner/users${qs({ search: debounced, active })}`);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false); const [actionError, setActionError] = useState<string | null>(null);
  const close = () => { setPending(null); setActionError(null); };

  async function confirm() {
    if (!pending) return;
    setBusy(true); setActionError(null);
    try {
      const base = `/api/owner/users/${encodeURIComponent(pending.user.id)}`;
      if (pending.kind === 'role') await ownerPut(`${base}/role`, { role: pending.role });
      else await ownerPost(`${base}/${pending.kind === 'remove' ? 'remove-membership' : pending.kind}`, {});
      close(); reload();
    } catch (e) { setActionError(e instanceof OwnerApiError ? e.message : 'Action failed.'); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Users" subtitle="All users across organizations. Credentials, secrets and tokens are never shown." />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[16rem] flex-1"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" aria-hidden /><input aria-label="Search users" placeholder="Search by name, email or id" value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputClass} pl-9`} /></div>
        <select aria-label="Filter by activity" value={active} onChange={(e) => setActive(e.target.value)} className={`${inputClass} w-44`}><option value="">All users</option><option value="true">Active</option><option value="false">Inactive</option></select>
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : !data || data.users.length === 0 ? <EmptyState title="No users match" /> : (
        <Table caption="Users" headers={['User', 'Organization', 'Role', 'Status', 'MFA', 'Last login', 'Actions']}>{data.users.map((u) => (
          <tr key={u.id}>
            <Td><p className="font-medium text-white">{u.name}{u.isPlatformOwner && <span className="ml-2"><Badge tone="amber">Platform owner</Badge></span>}</p><p className="text-xs text-slate-500">{u.email}</p></Td>
            <Td>{u.organizationName}{u.organizationStatus !== 'active' && <span className="ml-1"><Badge tone="amber">{u.organizationStatus}</Badge></span>}</Td>
            <Td>{u.isPlatformOwner ? <span className="text-slate-500">protected</span> : (
              <select aria-label={`Role for ${u.email}`} value={u.role} onChange={(e) => setPending({ kind: 'role', user: u, role: e.target.value })} className={`${inputClass} w-32 py-1`}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>)}</Td>
            <Td><Badge tone={u.active ? 'green' : 'red'}>{u.active ? 'active' : 'inactive'}</Badge></Td>
            <Td>{u.mfaEnabled ? 'On' : 'Off'}</Td><Td className="whitespace-nowrap text-xs text-slate-400">{formatDate(u.lastLoginAt)}</Td>
            <Td>{u.isPlatformOwner ? null : (
              <div className="flex gap-2">
                <button className={secondaryButton} onClick={() => setPending({ kind: u.active ? 'deactivate' : 'activate', user: u })}>{u.active ? 'Deactivate' : 'Activate'}</button>
                <button className={secondaryButton} onClick={() => setPending({ kind: 'remove', user: u })}>Remove access</button>
              </div>)}</Td>
          </tr>))}</Table>)}
      {pending && (
        <Modal title={pending.kind === 'role' ? 'Change role?' : pending.kind === 'remove' ? 'Remove access?' : pending.kind === 'deactivate' ? 'Deactivate user?' : 'Activate user?'} onClose={close}
          footer={<><button className={secondaryButton} onClick={close}>Cancel</button><button className={pending.kind === 'remove' || pending.kind === 'deactivate' ? dangerButton : primaryButton} disabled={busy} onClick={confirm}>Confirm</button></>}>
          <p className="text-sm text-slate-300">
            {pending.kind === 'role' && <>Change <b>{pending.user.email}</b> from <b>{pending.user.role}</b> to <b>{pending.role}</b>? This takes effect on their next request.</>}
            {pending.kind === 'deactivate' && <>Deactivate <b>{pending.user.email}</b>? Their sessions are revoked immediately.</>}
            {pending.kind === 'activate' && <>Allow <b>{pending.user.email}</b> to sign in again?</>}
            {pending.kind === 'remove' && <>Remove <b>{pending.user.email}</b> from <b>{pending.user.organizationName}</b>? Users belong to a single organization, so this deactivates the account and revokes all sessions. The record is kept for audit.</>}
          </p>
          {actionError && <p role="alert" className="text-sm text-rose-300">{actionError}</p>}
        </Modal>)}
    </>
  );
}
