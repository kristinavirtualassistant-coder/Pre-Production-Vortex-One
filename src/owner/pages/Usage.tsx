import { Card, EmptyState, ErrorState, Loading, PageHeader, Table, Td, Badge, formatNumber, statusTone, useOwnerData } from '../ui';

interface UsageData { period: string; metrics: Array<{ metric: string; used: number }>; organizations: Array<{ id: string; name: string; status: string; plan: string; active_users: number; leads: number; calls: number; campaigns: number }> }

export default function Usage() {
  const { data, error, loading, reload } = useOwnerData<UsageData>('/api/owner/usage');
  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  return (
    <>
      <PageHeader title="Usage" subtitle="Metered usage for the current month and the most active organizations." />
      <Card title="Platform metrics (current month)">
        {data.metrics.length === 0 ? <EmptyState title="No metered usage recorded this month" /> : (
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">{data.metrics.map((m) => <div key={m.metric}><dt className="text-xs uppercase text-slate-500">{m.metric.replace(/_/g, ' ')}</dt><dd className="text-xl font-semibold text-white tabular-nums">{formatNumber(m.used)}</dd></div>)}</dl>)}
      </Card>
      <Card title="Organizations by activity" className="mt-4">
        {data.organizations.length === 0 ? <EmptyState title="No organizations yet" /> : (
          <Table caption="Usage by organization" headers={['Organization', 'Status', 'Plan', 'Active users', 'Leads', 'Calls', 'Campaigns']}>{data.organizations.map((o) => (
            <tr key={o.id}><Td className="font-medium text-white">{o.name}</Td><Td><Badge tone={statusTone(o.status)}>{o.status}</Badge></Td><Td>{o.plan}</Td><Td>{formatNumber(o.active_users)}</Td><Td>{formatNumber(o.leads)}</Td><Td>{formatNumber(o.calls)}</Td><Td>{formatNumber(o.campaigns)}</Td></tr>))}</Table>)}
      </Card>
    </>
  );
}
