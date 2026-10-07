import React, { useState } from 'react';

interface Props {
  getAuthHeaders: () => Record<string, string>;
  organizationId: string;
  onRecorded?: () => void;
}

export const AnalyticsValueEventRecorder: React.FC<Props> = ({ getAuthHeaders, organizationId, onRecorded }) => {
  const [eventType, setEventType] = useState<'revenue'|'acquisition_value'|'management_value'|'other'>('revenue');
  const [amountUsd, setAmountUsd] = useState('');
  const [leadId, setLeadId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    const amount = Number(amountUsd);
    if (!Number.isFinite(amount) || amount < 0) {
      setMessage('Enter a non-negative amount.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/analytics/value-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), 'x-organization-id': organizationId },
        body: JSON.stringify({
          eventType,
          amountUsd: amount,
          leadId: leadId.trim() || undefined,
          propertyId: propertyId.trim() || undefined,
          campaignId: campaignId.trim() || undefined,
          metadata: { note: note.trim() || undefined, source: 'reporting_analytics_ui' },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Unable to record business value');
      setAmountUsd('');
      setNote('');
      setMessage('Value event recorded.');
      onRecorded?.();
    } catch (error: any) {
      setMessage(error?.message || 'Unable to record business value');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Record business value</h2>
          <p className="text-[11px] text-slate-500 mt-1">Use actual recorded revenue/value only. Estimated property value is not treated as revenue.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 mt-4">
        <label className="text-[11px] text-slate-500">Type
          <select value={eventType} onChange={e => setEventType(e.target.value as typeof eventType)} className="mt-1 w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs bg-white">
            <option value="revenue">Revenue</option>
            <option value="acquisition_value">Acquisition value</option>
            <option value="management_value">Management value</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="text-[11px] text-slate-500">Amount (USD)
          <input required min="0" step="0.01" type="number" value={amountUsd} onChange={e => setAmountUsd(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs" placeholder="0.00" />
        </label>
        <label className="text-[11px] text-slate-500">Lead ID (optional)
          <input value={leadId} onChange={e => setLeadId(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs" placeholder="lead_..." />
        </label>
        <label className="text-[11px] text-slate-500">Property ID (optional)
          <input value={propertyId} onChange={e => setPropertyId(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs" placeholder="property_..." />
        </label>
        <label className="text-[11px] text-slate-500">Campaign ID (optional)
          <input value={campaignId} onChange={e => setCampaignId(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs" placeholder="campaign_..." />
        </label>
      </div>
      <div className="flex flex-col md:flex-row gap-3 mt-3">
        <input value={note} onChange={e => setNote(e.target.value)} className="flex-1 border border-slate-300 rounded-lg px-2.5 py-2 text-xs" placeholder="Note / source reference (optional)" />
        <button disabled={saving} type="submit" className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold disabled:opacity-50">{saving ? 'Recording…' : 'Record value'}</button>
      </div>
      {message && <p className="text-[11px] mt-2 text-slate-600">{message}</p>}
    </form>
  );
};
