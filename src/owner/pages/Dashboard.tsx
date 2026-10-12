import { Badge, Card, EmptyState, ErrorState, Loading, PageHeader, Stat, Table, Td, formatDate, formatNumber, formatBytes, statusTone, useOwnerData } from '../ui';

interface Overview {
  organizations: { total: number; active: number; suspended: number; deactivated: number };
  users: { total: number; active: number };
  data: { contacts: number; leads: number; properties: number; propertyOwners: number };
  calls: { total: number; last24h: number };
  campaigns: { total: number; active: number };
  recentAuditEvents: Array<{ id: string; actor_role: string; action: string; target_type: string | null; target_id: string | null; result: string; created_at: string }>;
  recentSystemActivity: Array<{ id: string; organization_name: string | null; agent: string; action: string; status: string; created_at: string }>;
  backups: { targets: Array<{ target: string; label: string; status: string; lastSuccessfulBackupAt: string | null }> };
  health: { status: string; database: { status: string; latencyMs?: number; sizeBytes?: number }; jobs: { counts: Record<string, number> } };
}

export default function Dashboard({ navigate }: { navigate: (to: string) => void }) {
  const { data, error, loading, reload } = useOwnerData<Overview>('/api/owner/overview');
  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const o = data;
  return (
    <>
      <PageHeader title="Platform overview" subtitle="Live figures from the production database. Nothing here is estimated." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Organizations" value={formatNumber(o.organizations.total)} hint={`${o.organizations.active} active · ${o.organizations.suspended} suspended · ${o.organizations.deactivated} deactivated`} />
        <Stat label="Active organizations" value={formatNumber(o.organizations.active)} />
        <Stat label="Suspended organizations" value={formatNumber(o.organizations.suspended)} />
        <Stat label="Users" value={formatNumber(o.users.total)} hint={`${o.users.active} active`} />
        <Stat label="Contacts" value={formatNumber(o.data.contacts)} />
        <Stat label="Leads / properties" value={`${formatNumber(o.data.leads)} / ${formatNumber(o.data.properties)}`} hint={`${formatNumber(o.data.propertyOwners)} property owners`} />
        <Stat label="Calls" value={formatNumber(o.calls.total)} hint={`${o.calls.last24h} in the last 24h`} />
        <Stat label="Campaigns" value={formatNumber(o.campaigns.total)} hint={`${o.campaigns.active} active`} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="System health" action={<button className="text-xs text-cyan-300 hover:underline" onClick={() => navigate('/owner/system')}>Details</button>}>
          <div className="flex items-center gap-3"><Badge tone={statusTone(o.health.status)}>{o.health.status}</Badge>
            <span className="text-sm text-slate-300">Database {o.health.database.status}{o.health.database.latencyMs != null ? ` · ${o.health.database.latencyMs} ms` : ''}{o.health.database.sizeBytes != null ? ` · ${formatBytes(o.health.database.sizeBytes)}` : ''}</span></div>
          <p className="mt-2 text-xs text-slate-500">Jobs: {Object.keys(o.health.jobs.counts).length ? Object.entries(o.health.jobs.counts).map(([k, v]) => `${v} ${k}`).join(' · ') : 'none recorded'}</p>
        </Card>
        <Card title="Backups" action={<button className="text-xs text-cyan-300 hover:underline" onClick={() => navigate('/owner/backups')}>Details</button>}>
          <ul className="space-y-2">{o.backups.targets.map((t) => (
            <li key={t.target} className="flex items-center justify-between gap-2 text-sm"><span className="text-slate-300">{t.label}</span>
              <span className="flex items-center gap-2"><Badge tone={statusTone(t.status)}>{t.status === 'not_configured' ? 'Not configured' : t.status}</Badge><span className="text-xs text-slate-500">{t.lastSuccessfulBackupAt ? formatDate(t.lastSuccessfulBackupAt) : ''}</span></span></li>))}</ul>
        </Card>
        <Card title="Recent audit events" action={<button className="text-xs text-cyan-300 hover:underline" onClick={() => navigate('/owner/audit-logs')}>All events</button>}>
          {o.recentAuditEvents.length === 0 ? <EmptyState title="No owner actions recorded yet" /> : (
            <Table caption="Recent owner audit events" headers={['When', 'Action', 'Result']}>{o.recentAuditEvents.map((e) => (
              <tr key={e.id}><Td className="whitespace-nowrap text-xs text-slate-400">{formatDate(e.created_at)}</Td><Td>{e.action}</Td><Td><Badge tone={statusTone(e.result)}>{e.result}</Badge></Td></tr>))}</Table>)}
        </Card>
        <Card title="Recent system activity">
          {o.recentSystemActivity.length === 0 ? <EmptyState title="No customer activity recorded yet" /> : (
            <Table caption="Recent customer activity" headers={['When', 'Organization', 'Activity']}>{o.recentSystemActivity.map((a) => (
              <tr key={a.id}><Td className="whitespace-nowrap text-xs text-slate-400">{formatDate(a.created_at)}</Td><Td>{a.organization_name || '—'}</Td><Td>{a.action}</Td></tr>))}</Table>)}
        </Card>
      </div>
    </>
  );
}
