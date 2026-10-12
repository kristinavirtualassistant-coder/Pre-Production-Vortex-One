import { Badge, Card, ErrorState, Loading, PageHeader, Stat, formatBytes, formatDate, formatNumber, secondaryButton, statusTone, useOwnerData } from '../ui';

interface Health {
  status: string; checkedAt: string;
  database: { status: string; latencyMs?: number; version?: string; sizeBytes?: number; migrationsApplied?: number | null; lastMigrationAt?: string | null };
  connectionPool: { total: number | null; idle: number | null; waiting: number | null };
  jobs: { counts: Record<string, number>; lastCompletedAt: string | null };
  process: { uptimeSeconds: number; node: string; rssBytes: number; heapUsedBytes: number; environment: string };
}

export default function SystemPage() {
  const { data, error, loading, reload } = useOwnerData<Health>('/api/owner/system');
  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const h = data;
  return (
    <>
      <PageHeader title="System" subtitle={`Checked ${formatDate(h.checkedAt)}`} action={<button className={secondaryButton} onClick={reload}>Refresh</button>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Overall" value={<Badge tone={statusTone(h.status)}>{h.status}</Badge>} />
        <Stat label="Database" value={<Badge tone={statusTone(h.database.status)}>{h.database.status}</Badge>} hint={h.database.latencyMs != null ? `${h.database.latencyMs} ms` : undefined} />
        <Stat label="Database size" value={formatBytes(h.database.sizeBytes)} hint={h.database.version} />
        <Stat label="Migrations applied" value={formatNumber(h.database.migrationsApplied)} hint={h.database.lastMigrationAt ? `Last ${formatDate(h.database.lastMigrationAt)}` : undefined} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Background jobs">
          {Object.keys(h.jobs.counts).length === 0 ? <p className="text-sm text-slate-400">No jobs recorded.</p> : <ul className="space-y-1 text-sm">{Object.entries(h.jobs.counts).map(([k, v]) => <li key={k} className="flex justify-between"><span className="text-slate-300">{k}</span><span className="tabular-nums text-white">{formatNumber(Number(v))}</span></li>)}</ul>}
          <p className="mt-3 text-xs text-slate-500">Last job completed: {h.jobs.lastCompletedAt ? formatDate(h.jobs.lastCompletedAt) : 'never'}</p>
        </Card>
        <Card title="Runtime">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs uppercase text-slate-500">Environment</dt><dd className="text-white">{h.process.environment}</dd></div>
            <div><dt className="text-xs uppercase text-slate-500">Node</dt><dd className="text-white">{h.process.node}</dd></div>
            <div><dt className="text-xs uppercase text-slate-500">Uptime</dt><dd className="text-white">{Math.floor(h.process.uptimeSeconds / 3600)}h {Math.floor((h.process.uptimeSeconds % 3600) / 60)}m</dd></div>
            <div><dt className="text-xs uppercase text-slate-500">Memory (RSS)</dt><dd className="text-white">{formatBytes(h.process.rssBytes)}</dd></div>
            <div><dt className="text-xs uppercase text-slate-500">DB pool (total / idle / waiting)</dt><dd className="text-white">{h.connectionPool.total ?? '—'} / {h.connectionPool.idle ?? '—'} / {h.connectionPool.waiting ?? '—'}</dd></div>
          </dl>
        </Card>
      </div>
    </>
  );
}
