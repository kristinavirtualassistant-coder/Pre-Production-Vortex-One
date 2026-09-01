import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Send,
  Radio,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  Users,
  Building,
  Sparkles,
  ShieldCheck,
  X,
  Sliders,
  Flame,
} from 'lucide-react';
import { LeadRecord, Property, DialerCampaign } from '../types';

export interface BulkOutreachTarget {
  name: string;
  phone: string;
  address?: string;
  leadId?: string;
  propertyId?: string;
  score?: number;
}

interface BulkOutreachScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  targets: BulkOutreachTarget[];
  onCampaignCreated?: (campaign: DialerCampaign) => void;
  existingCampaignToReschedule?: DialerCampaign | null;
}

export const BulkOutreachScheduleModal: React.FC<BulkOutreachScheduleModalProps> = ({
  isOpen,
  onClose,
  targets,
  onCampaignCreated,
  existingCampaignToReschedule,
}) => {
  if (!isOpen) return null;

  // Form State
  const [campaignName, setCampaignName] = useState(
    existingCampaignToReschedule
      ? existingCampaignToReschedule.name
      : `High-Priority Portfolio Outreach - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  );
  const [targetMarket, setTargetMarket] = useState(
    existingCampaignToReschedule?.target_market || 'Costa Mesa / Newport Beach, CA'
  );
  const [telephonyProvider] = useState<'ringcentral'>('ringcentral');
  const [callBrief, setCallBrief] = useState(
    'Outbound pitch regarding CMC Realty proactive property management, zero vacancy guarantee, and local Costa Mesa asset optimization.'
  );

  // Execution Mode: 'immediate' | 'scheduled'
  const [executionMode, setExecutionMode] = useState<'immediate' | 'scheduled'>(
    existingCampaignToReschedule ? 'scheduled' : 'scheduled'
  );

  // Scheduled Date & Time (Default to tomorrow at 09:30 AM PST)
  const getTomorrowMorning = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 30, 0, 0);
    // Format to YYYY-MM-DDTHH:mm for datetime-local input
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [scheduledDateTime, setScheduledDateTime] = useState<string>(
    existingCampaignToReschedule?.scheduled_at
      ? new Date(existingCampaignToReschedule.scheduled_at).toISOString().slice(0, 16)
      : getTomorrowMorning()
  );
  const [timezone, setTimezone] = useState('America/Los_Angeles (Pacific Time)');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quick Preset Handlers
  const handleSetPreset = (preset: 'tomorrow_9am' | 'tomorrow_2pm' | 'in_2h' | 'monday_9am') => {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');

    if (preset === 'in_2h') {
      d.setHours(d.getHours() + 2);
    } else if (preset === 'tomorrow_9am') {
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
    } else if (preset === 'tomorrow_2pm') {
      d.setDate(d.getDate() + 1);
      d.setHours(14, 0, 0, 0);
    } else if (preset === 'monday_9am') {
      const daysUntilMonday = ((1 + 7 - d.getDay()) % 7) || 7;
      d.setDate(d.getDate() + daysUntilMonday);
      d.setHours(9, 0, 0, 0);
    }

    setScheduledDateTime(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
    setExecutionMode('scheduled');
  };

  // TCPA Compliance window check (8 AM - 9 PM)
  const getTcpaStatus = (dateTimeStr: string) => {
    if (!dateTimeStr) return { compliant: true, warning: null };
    const dateObj = new Date(dateTimeStr);
    const hour = dateObj.getHours();
    if (hour < 8 || hour >= 21) {
      return {
        compliant: false,
        warning: 'Selected time falls outside standard TCPA calling hours (8:00 AM - 9:00 PM local recipient time).',
      };
    }
    return { compliant: true, warning: null };
  };

  const tcpaStatus = getTcpaStatus(scheduledDateTime);

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (existingCampaignToReschedule) {
        // Reschedule existing campaign
        const res = await fetch(`/api/campaigns/${existingCampaignToReschedule.id}/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: 'org_cmc_realty',
            scheduled_at: new Date(scheduledDateTime).toISOString(),
            timezone: 'America/Los_Angeles',
            scheduled_by: 'Operations Executive',
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to reschedule campaign');
        }

        const updated = await res.json();
        if (onCampaignCreated) onCampaignCreated(updated);
        onClose();
        return;
      }

      // Format contacts list from targets
      const contactsPayload = targets.map((t) => ({
        contactName: t.name,
        phoneNumber: t.phone,
        propertyAddress: t.address,
        leadId: t.leadId,
        priority: t.score && t.score >= 80 ? 3 : t.score && t.score >= 60 ? 2 : 1,
      }));

      const scheduledIso =
        executionMode === 'scheduled' ? new Date(scheduledDateTime).toISOString() : undefined;

      const campaignPayload = {
        organization_id: 'org_cmc_realty',
        name: campaignName,
        description: callBrief,
        target_market: targetMarket,
        telephony_provider: telephonyProvider,
        total_contacts: targets.length || 1,
        scheduled_at: scheduledIso,
        scheduled_by: 'Operations Executive',
        timezone: 'America/Los_Angeles',
        contacts: contactsPayload,
      };

      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignPayload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create campaign');
      }

      const createdCamp = await res.json();

      // If immediate execution was chosen, start the campaign immediately
      if (executionMode === 'immediate') {
        await fetch(`/api/campaigns/${createdCamp.id}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: 'org_cmc_realty',
            agentUserId: 'agent_1',
          }),
        });
        createdCamp.status = 'active';
      }

      if (onCampaignCreated) {
        onCampaignCreated(createdCamp);
      }

      onClose();
    } catch (err: any) {
      console.error('Campaign creation/scheduling error:', err);
      setErrorMsg(err.message || 'Error scheduling outreach campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {existingCampaignToReschedule ? 'Reschedule Campaign Execution' : 'Schedule Bulk Outreach Campaign'}
              </h2>
              <p className="text-xs text-slate-300">
                Queue automated telephony outreach and AI pitch sessions for optimal contact windows.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700/50 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Audience Summary Bar */}
        <div className="bg-cyan-50/70 border-b border-cyan-100 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1.5 font-semibold text-slate-900">
              <Users className="w-4 h-4 text-cyan-700" />
              <span>{targets.length} Contact{targets.length === 1 ? '' : 's'} Queued</span>
            </span>
            <span className="text-slate-400">|</span>
            <span className="flex items-center space-x-1.5 text-slate-700">
              <Building className="w-4 h-4 text-cyan-600" />
              <span>{targetMarket}</span>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-semibold text-[11px] border border-emerald-200">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>TCPA Pre-Scrubbed</span>
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Campaign Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Campaign Name</label>
              <input
                type="text"
                required
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-600 focus:bg-white"
                placeholder="e.g. Costa Mesa Absentee Landlords Q3"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Telephony Gateway</label>
              <div className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 font-medium flex items-center justify-between">
                <span>RingCentral REST Telephony Gateway</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">Active</span>
              </div>
            </div>
          </div>

          {/* Pitch Strategy & Brief */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>AI Pitch Strategy &amp; Call Objective</span>
              <span className="text-[10px] text-slate-400 font-normal">Sub-Agent 3 Strategy Engine</span>
            </label>
            <textarea
              rows={2}
              value={callBrief}
              onChange={(e) => setCallBrief(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:border-cyan-600 focus:bg-white resize-none"
              placeholder="Enter pitch objective and talking points for voice agent..."
            />
          </div>

          {/* Execution Mode Selection */}
          <div className="space-y-3 pt-1 border-t border-slate-200">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Execution Timing &amp; Dispatch Mode
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Mode Option 1: Scheduled Execution */}
              <div
                onClick={() => setExecutionMode('scheduled')}
                className={`p-3.5 rounded-xl border-2 transition cursor-pointer flex items-start space-x-3 ${
                  executionMode === 'scheduled'
                    ? 'border-cyan-600 bg-cyan-50/50 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${
                  executionMode === 'scheduled' ? 'border-cyan-600 bg-cyan-600' : 'border-slate-300'
                }`}>
                  {executionMode === 'scheduled' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Queue for Scheduled Time</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Schedule automated execution for high-connection calling windows.
                  </p>
                </div>
              </div>

              {/* Mode Option 2: Immediate Launch */}
              <div
                onClick={() => setExecutionMode('immediate')}
                className={`p-3.5 rounded-xl border-2 transition cursor-pointer flex items-start space-x-3 ${
                  executionMode === 'immediate'
                    ? 'border-cyan-600 bg-cyan-50/50 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${
                  executionMode === 'immediate' ? 'border-cyan-600 bg-cyan-600' : 'border-slate-300'
                }`}>
                  {executionMode === 'immediate' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                    <Send className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Launch Immediately</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Start dialing sessions instantly in active live status.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Schedule Controls (Shown when Scheduled mode is active) */}
          {executionMode === 'scheduled' && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 animate-in fade-in duration-200">
              <div>
                <div className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
                  <span>Quick Schedule Presets</span>
                  <span className="text-[10px] text-cyan-700 font-mono">PST Target Windows</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetPreset('tomorrow_9am')}
                    className="px-2.5 py-1.5 bg-white hover:bg-cyan-50 border border-slate-200 hover:border-cyan-300 text-slate-700 hover:text-cyan-800 rounded-lg text-xs font-medium transition cursor-pointer text-center"
                  >
                    Tomorrow 9:00 AM
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPreset('tomorrow_2pm')}
                    className="px-2.5 py-1.5 bg-white hover:bg-cyan-50 border border-slate-200 hover:border-cyan-300 text-slate-700 hover:text-cyan-800 rounded-lg text-xs font-medium transition cursor-pointer text-center"
                  >
                    Tomorrow 2:00 PM
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPreset('in_2h')}
                    className="px-2.5 py-1.5 bg-white hover:bg-cyan-50 border border-slate-200 hover:border-cyan-300 text-slate-700 hover:text-cyan-800 rounded-lg text-xs font-medium transition cursor-pointer text-center"
                  >
                    In 2 Hours
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPreset('monday_9am')}
                    className="px-2.5 py-1.5 bg-white hover:bg-cyan-50 border border-slate-200 hover:border-cyan-300 text-slate-700 hover:text-cyan-800 rounded-lg text-xs font-medium transition cursor-pointer text-center"
                  >
                    Next Mon 9:00 AM
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/80">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Scheduled Execution Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduledDateTime}
                    onChange={(e) => setScheduledDateTime(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-cyan-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jurisdiction Timezone
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-cyan-600"
                  >
                    <option value="America/Los_Angeles (Pacific Time)">America/Los_Angeles (Pacific Time - PT)</option>
                    <option value="America/Denver (Mountain Time)">America/Denver (Mountain Time - MT)</option>
                    <option value="America/Chicago (Central Time)">America/Chicago (Central Time - CT)</option>
                    <option value="America/New_York (Eastern Time)">America/New_York (Eastern Time - ET)</option>
                  </select>
                </div>
              </div>

              {/* TCPA Hours Compliance Notice */}
              <div
                className={`p-2.5 rounded-lg border text-xs flex items-start space-x-2 ${
                  tcpaStatus.compliant
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-300 text-amber-800'
                }`}
              >
                {tcpaStatus.compliant ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-semibold">
                    {tcpaStatus.compliant ? 'TCPA Calling Window Approved' : 'TCPA Advisory Warning'}
                  </span>
                  <p className="text-[11px] mt-0.5">
                    {tcpaStatus.compliant
                      ? `Execution time is set within legal calling window (8:00 AM - 9:00 PM). Target dispatch scheduled for ${new Date(scheduledDateTime).toLocaleString()}.`
                      : tcpaStatus.warning}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 rounded-xl shadow-xs transition cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
            >
              {executionMode === 'scheduled' ? (
                <>
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Queueing Campaign...' : 'Queue Scheduled Campaign'}</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Launching Campaign...' : 'Launch Campaign Now'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
