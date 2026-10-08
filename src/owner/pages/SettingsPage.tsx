import { Badge, Card, ErrorState, Loading, PageHeader, Table, Td, statusTone, useOwnerData } from '../ui';

interface Setting { key: string; label: string; value: unknown; status: 'implemented' | 'unavailable' | 'planned'; editable: boolean; description: string }

const show = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : Array.isArray(v) ? (v.length ? v.join(', ') : 'None') : String(v));

export default function SettingsPage() {
  const { data, error, loading, reload } = useOwnerData<{ note: string; settings: Setting[] }>('/api/owner/settings');
  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  return (
    <>
      <PageHeader title="Settings" subtitle={data.note} />
      <Card>
        <Table caption="Platform settings" headers={['Setting', 'Value', 'Status', 'Description']}>{data.settings.map((s) => (
          <tr key={s.key}><Td className="font-medium text-white">{s.label}</Td><Td>{show(s.value)}</Td><Td><Badge tone={statusTone(s.status)}>{s.status}</Badge></Td><Td className="text-xs text-slate-400">{s.description}</Td></tr>))}</Table>
      </Card>
      <p className="mt-3 text-xs text-slate-500">Implemented = enforced by the backend today (read-only here). Unavailable = not supported. Planned = not built yet.</p>
    </>
  );
}
