import { Fragment } from 'react';
import { Badge, Card, ErrorState, Loading, PageHeader, formatDate, secondaryButton, statusTone, useOwnerData } from '../ui';

interface Target { target: string; label: string; status: 'success' | 'failure' | 'running' | 'not_configured'; message: string | null; lastRun: { startedAt: string; finishedAt: string | null; status: string } | null; lastSuccessfulBackupAt: string | null; lastFailure: { at: string | null; error: string } | null }

export default function Backups() {
  const { data, error, loading, reload } = useOwnerData<{ targets: Target[]; liveDatabase: { reachable: boolean }; note: string }>('/api/owner/backups');
  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  return (
    <>
      <PageHeader title="Backups" subtitle="Reported only from runs recorded by backup jobs. A backup is never assumed to have succeeded." action={<button className={secondaryButton} onClick={reload}>Refresh</button>} />
      <p className="mb-4 flex items-center gap-2 text-sm text-slate-300">PostgreSQL connection: <Badge tone={data.liveDatabase.reachable ? 'green' : 'red'}>{data.liveDatabase.reachable ? 'reachable' : 'unreachable'}</Badge></p>
      <div className="grid gap-4 lg:grid-cols-3">{data.targets.map((t) => (
        <Fragment key={t.target}><Card title={t.label} action={<Badge tone={statusTone(t.status)}>{t.status === 'not_configured' ? 'Not configured' : t.status}</Badge>}>
          {t.status === 'not_configured' ? <p className="text-sm text-slate-400">{t.message}</p> : (
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs uppercase text-slate-500">Last successful backup</dt><dd className="text-white">{t.lastSuccessfulBackupAt ? formatDate(t.lastSuccessfulBackupAt) : 'None recorded'}</dd></div>
              <div><dt className="text-xs uppercase text-slate-500">Last run</dt><dd className="text-white">{t.lastRun ? `${t.lastRun.status} · ${formatDate(t.lastRun.startedAt)}` : '—'}</dd></div>
              <div><dt className="text-xs uppercase text-slate-500">Last failure</dt><dd className={t.lastFailure ? 'text-rose-300' : 'text-slate-400'}>{t.lastFailure ? `${formatDate(t.lastFailure.at)} — ${t.lastFailure.error}` : 'None recorded'}</dd></div>
            </dl>)}
        </Card></Fragment>))}</div>
      <p className="mt-4 text-xs text-slate-500">{data.note}</p>
    </>
  );
}
