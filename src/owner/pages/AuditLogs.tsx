import { useEffect, useState } from 'react';
import { OwnerApiError, ownerGet, qs } from '../api';
import { Badge, EmptyState, ErrorState, Loading, PageHeader, Table, Td, formatDate, inputClass, secondaryButton, statusTone } from '../ui';

interface Entry { id: string; actor_user_id: string | null; actor_role: string; action: string; target_type: string | null; target_id: string | null; organization_id: string | null; result: string; ip_address: string | null; user_agent: string | null; created_at: string; details: Record<string, unknown> }

/** Read-only. There is no UI (and no API) to edit or delete audit entries. */
export default function AuditLogs() {
  const [action, setAction] = useState(''); const [result, setResult] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [more, setMore] = useState(false);

  async function load(before?: string) {
    setLoading(true); setError(null);
    try {
      const r = await ownerGet<{ entries: Entry[] }>(`/api/owner/audit-logs${qs({ action, result, before, limit: 50 })}`);
      setEntries((prev) => (before ? [...prev, ...r.entries] : r.entries)); setMore(r.entries.length === 50);
    } catch (e) { setError(e instanceof OwnerApiError ? e.message : 'Could not load the audit log.'); } finally { setLoading(false); }
  }
  useEffect(() => { const t = setTimeout(() => void load(), 200); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [action, result]);

  return (
    <>
      <PageHeader title="Audit logs" subtitle="Append-only record of owner and security-sensitive actions." />
      <div className="mb-4 flex flex-wrap gap-3">
        <input aria-label="Filter by action prefix" placeholder="Action prefix, e.g. owner.organization" value={action} onChange={(e) => setAction(e.target.value)} className={`${inputClass} min-w-[16rem] flex-1`} />
        <select aria-label="Filter by result" value={result} onChange={(e) => setResult(e.target.value)} className={`${inputClass} w-40`}><option value="">All results</option><option value="success">Success</option><option value="denied">Denied</option><option value="failure">Failure</option></select>
      </div>
      {error ? <ErrorState message={error} onRetry={() => load()} /> : loading && entries.length === 0 ? <Loading /> : entries.length === 0 ? <EmptyState title="No audit events match" /> : (
        <>
          <Table caption="Platform audit log" headers={['When', 'Actor', 'Action', 'Target', 'Organization', 'Result', 'IP']}>{entries.map((e) => (
            <tr key={e.id}><Td className="whitespace-nowrap text-xs text-slate-400">{formatDate(e.created_at)}</Td><Td><p>{e.actor_role}</p><p className="text-xs text-slate-500">{e.actor_user_id || '—'}</p></Td>
              <Td><p className="text-white">{e.action}</p>{Object.keys(e.details || {}).length > 0 && <p className="max-w-xs truncate text-xs text-slate-500" title={JSON.stringify(e.details)}>{JSON.stringify(e.details)}</p>}</Td>
              <Td className="text-xs">{e.target_type ? `${e.target_type}: ${e.target_id ?? ''}` : '—'}</Td><Td className="text-xs">{e.organization_id || '—'}</Td><Td><Badge tone={statusTone(e.result)}>{e.result}</Badge></Td><Td className="text-xs text-slate-400">{e.ip_address || '—'}</Td></tr>))}</Table>
          {more && <div className="mt-4 text-center"><button className={secondaryButton} disabled={loading} onClick={() => load(entries[entries.length - 1].created_at)}>{loading ? 'Loading…' : 'Load older events'}</button></div>}
        </>)}
    </>
  );
}
