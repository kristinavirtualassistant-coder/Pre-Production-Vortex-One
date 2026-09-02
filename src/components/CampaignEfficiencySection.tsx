import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  Target,
  PhoneCall,
  Users,
  CheckCircle2,
  CalendarCheck,
  Zap,
  BarChart3,
  HelpCircle,
  ArrowUpRight,
  ShieldCheck,
  Filter,
} from 'lucide-react';
import { DialerCampaign, CallRecord, DialerMetrics } from '../types';

interface CampaignEfficiencySectionProps {
  campaigns: DialerCampaign[];
  calls: CallRecord[];
  selectedCampaignId?: string;
  onSelectCampaign?: (campaignId: string) => void;
}

export const CampaignEfficiencySection: React.FC<CampaignEfficiencySectionProps> = ({
  campaigns,
  calls,
  selectedCampaignId,
  onSelectCampaign,
}) => {
  const [activeScope, setActiveScope] = useState<'selected' | 'all'>('selected');
  const [costPerMinute, setCostPerMinute] = useState<number>(0.03); // $0.03/min telephony
  const [costPerSkipTrace, setCostPerSkipTrace] = useState<number>(0.15); // $0.15 per contact data cost
  const [carrierConnectionFee, setCarrierConnectionFee] = useState<number>(0.015); // $0.015 per dialed attempt

  // Determine current active campaign
  const currentCampaign = useMemo(() => {
    if (selectedCampaignId) {
      return campaigns.find((c) => c.id === selectedCampaignId) || campaigns[0] || null;
    }
    return campaigns[0] || null;
  }, [campaigns, selectedCampaignId]);

  // Compute metrics based on selected scope
  const efficiencyData = useMemo(() => {
    const relevantCampaigns =
      activeScope === 'selected' && currentCampaign ? [currentCampaign] : campaigns;

    let totalDials = 0;
    let totalConnected = 0;
    let totalAppointments = 0;
    let totalTalkTimeSeconds = 0;

    relevantCampaigns.forEach((camp) => {
      totalDials += camp.dialed_count || 0;
      totalConnected += camp.connected_count || 0;
      totalAppointments += camp.converted_count || 0;
    });

    // Also factor in real-time call records
    const relevantCalls = calls.filter((c) => {
      if (activeScope === 'selected' && currentCampaign) {
        return c.campaign_id === currentCampaign.id;
      }
      return true;
    });

    // Account for actual call duration from call records
    const callsDuration = relevantCalls.reduce((acc, c) => acc + (c.duration_seconds || 0), 0);
    totalTalkTimeSeconds = Math.max(totalTalkTimeSeconds, callsDuration);

    // If campaign dial counts are smaller than calls length, use calls length
    if (relevantCalls.length > totalDials) {
      totalDials = relevantCalls.length;
      totalConnected = relevantCalls.filter(
        (c) => c.status === 'completed' || c.status === 'connected' || (c.duration_seconds && c.duration_seconds > 0)
      ).length;
      totalAppointments = relevantCalls.filter(
        (c) => c.disposition === 'interested' || (c.notes && c.notes.toLowerCase().includes('proposal'))
      ).length;
    }

    // Default minimum baseline to ensure informative display if zero dials yet
    const effectiveDials = Math.max(totalDials, 1);
    const effectiveConnected = Math.max(totalConnected, 0);
    const effectiveAppointments = Math.max(totalAppointments, 0);
    const totalMinutes = totalTalkTimeSeconds > 0 ? totalTalkTimeSeconds / 60 : effectiveConnected * 2.2;

    // Cost Model Breakdown
    const telephonySpend = totalMinutes * costPerMinute;
    const skipTraceSpend = effectiveDials * costPerSkipTrace;
    const carrierFees = effectiveDials * carrierConnectionFee;
    const totalSpend = telephonySpend + skipTraceSpend + carrierFees;

    // Cost Per Lead (CPL) = Total Spend / Converted Leads (Appointments Set)
    const costPerLead = effectiveAppointments > 0 ? totalSpend / effectiveAppointments : totalSpend;

    // Cost Per Connected Contact (CPC)
    const costPerContact = effectiveConnected > 0 ? totalSpend / effectiveConnected : 0;

    // Appointment Set Rate (ASR)
    // 1. Overall ASR (% of total dials that resulted in appointment)
    const appointmentSetRate = totalDials > 0 ? (totalAppointments / totalDials) * 100 : 0;
    
    // 2. Connect-to-Appointment Rate (% of connected calls that resulted in appointment)
    const connectToAppointmentRate =
      totalConnected > 0 ? (totalAppointments / totalConnected) * 100 : 0;

    // Connection Rate (% of dials that connected)
    const connectionRate = totalDials > 0 ? (totalConnected / totalDials) * 100 : 0;

    return {
      totalDials,
      totalConnected,
      totalAppointments,
      totalTalkTimeSeconds,
      totalMinutes,
      telephonySpend,
      skipTraceSpend,
      carrierFees,
      totalSpend,
      costPerLead,
      costPerContact,
      appointmentSetRate,
      connectToAppointmentRate,
      connectionRate,
    };
  }, [
    activeScope,
    currentCampaign,
    campaigns,
    calls,
    costPerMinute,
    costPerSkipTrace,
    carrierConnectionFee,
  ]);

  // Per-campaign comparison list
  const campaignComparisons = useMemo(() => {
    return campaigns.map((camp) => {
      const campCalls = calls.filter((c) => c.campaign_id === camp.id);
      const dials = Math.max(camp.dialed_count || 0, campCalls.length);
      const connected = Math.max(
        camp.connected_count || 0,
        campCalls.filter((c) => c.status === 'completed' || c.status === 'connected').length
      );
      const appointments = Math.max(
        camp.converted_count || 0,
        campCalls.filter((c) => c.disposition === 'interested').length
      );

      const durationSec = campCalls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
      const minutes = durationSec > 0 ? durationSec / 60 : connected * 2.2;

      const spend = minutes * costPerMinute + dials * costPerSkipTrace + dials * carrierConnectionFee;
      const cpl = appointments > 0 ? spend / appointments : spend;
      const asr = dials > 0 ? (appointments / dials) * 100 : 0;
      const connectRate = dials > 0 ? (connected / dials) * 100 : 0;

      return {
        id: camp.id,
        name: camp.name,
        target_market: camp.target_market,
        status: camp.status,
        dials,
        connected,
        appointments,
        spend,
        cpl,
        asr,
        connectRate,
      };
    });
  }, [campaigns, calls, costPerMinute, costPerSkipTrace, carrierConnectionFee]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 shadow-2xs">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Campaign Efficiency &amp; Unit Economics</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Live Telemetry
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Real-time Cost-Per-Lead (CPL), Appointment-Set-Rate (ASR), and multi-channel acquisition ROI.
            </p>
          </div>
        </div>

        {/* Scope Selector */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setActiveScope('selected')}
              className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                activeScope === 'selected'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active Campaign
            </button>
            <button
              onClick={() => setActiveScope('all')}
              className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                activeScope === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Campaigns ({campaigns.length})
            </button>
          </div>

          {activeScope === 'selected' && campaigns.length > 0 && onSelectCampaign && (
            <select
              value={currentCampaign?.id || ''}
              onChange={(e) => onSelectCampaign(e.target.value)}
              aria-label="Select Active Campaign"
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
            >
              {campaigns.map((camp) => (
                <option key={camp.id} value={camp.id}>
                  {camp.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Primary KPI Grid: CPL & ASR Highlighted */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Cost-Per-Lead (CPL) */}
        <div className="bg-gradient-to-b from-cyan-50/50 to-white border border-cyan-200/80 rounded-xl p-4 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-cyan-900 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-cyan-700" />
              Cost-Per-Lead (CPL)
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-100/70 text-cyan-800">
              Target &lt;$35.00
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-slate-900">
              ${efficiencyData.costPerLead.toFixed(2)}
            </div>
            <div className="text-[11px] font-semibold text-emerald-600 flex items-center">
              <ArrowUpRight className="w-3.5 h-3.5" />
              Optimal
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500 leading-tight">
            Based on {efficiencyData.totalAppointments} converted owner lead{efficiencyData.totalAppointments === 1 ? '' : 's'} across ${efficiencyData.totalSpend.toFixed(2)} total spend.
          </p>
        </div>

        {/* Metric 2: Appointment-Set-Rate (ASR) */}
        <div className="bg-gradient-to-b from-emerald-50/50 to-white border border-emerald-200/80 rounded-xl p-4 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
              <CalendarCheck className="w-4 h-4 text-emerald-700" />
              Appointment-Set-Rate (ASR)
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100/70 text-emerald-800">
              Target &gt;15%
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-slate-900">
              {efficiencyData.appointmentSetRate.toFixed(1)}%
            </div>
            <div className="text-[11px] font-semibold text-emerald-700">
              {efficiencyData.totalAppointments}/{efficiencyData.totalDials} Dials
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500 leading-tight">
            {efficiencyData.connectToAppointmentRate.toFixed(1)}% appointment conversion on connected owner conversations.
          </p>
        </div>

        {/* Metric 3: Cost-Per-Connected Contact (CPC) */}
        <div className="bg-gradient-to-b from-indigo-50/50 to-white border border-indigo-200/80 rounded-xl p-4 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-700" />
              Cost Per Contact (CPC)
            </span>
            <span className="text-[10px] font-mono text-indigo-700 bg-indigo-100/70 px-1.5 py-0.5 rounded font-bold">
              {efficiencyData.connectionRate.toFixed(1)}% Connect
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-slate-900">
              ${efficiencyData.costPerContact.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500">
              {efficiencyData.totalConnected} Reached
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500 leading-tight">
            Average acquisition expense per live owner conversation and brief delivery.
          </p>
        </div>

        {/* Metric 4: Total Campaign Spend & Data Cost */}
        <div className="bg-gradient-to-b from-slate-50 to-white border border-slate-200 rounded-xl p-4 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-600" />
              Total Campaign Spend
            </span>
            <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
              Telephony + Data
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-slate-900">
              ${efficiencyData.totalSpend.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500">
              {efficiencyData.totalMinutes.toFixed(1)} mins talk
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500 leading-tight">
            Breakdown: ${efficiencyData.telephonySpend.toFixed(2)} minutes + ${efficiencyData.skipTraceSpend.toFixed(2)} skip-trace + ${efficiencyData.carrierFees.toFixed(2)} carrier fees.
          </p>
        </div>
      </div>

      {/* Visual Acquisition Funnel & Cost Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* Acquisition Funnel Conversion Bar */}
        <div className="lg:col-span-2 bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-cyan-600" />
              Campaign Conversion Funnel &amp; Yield
            </h3>
            <span className="text-[11px] font-medium text-slate-500">
              {efficiencyData.totalDials} Total Attempts
            </span>
          </div>

          <div className="space-y-2.5">
            {/* Stage 1: Dialed Attempts */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">1. Total Dialed Attempts</span>
                <span className="font-mono text-slate-600 font-bold">{efficiencyData.totalDials} (100%)</span>
              </div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div className="bg-cyan-600 h-full rounded-full w-full" />
              </div>
            </div>

            {/* Stage 2: Connected Conversations */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">2. Connected Owner Talks</span>
                <span className="font-mono text-slate-600 font-bold">
                  {efficiencyData.totalConnected} ({efficiencyData.connectionRate.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(Math.max(efficiencyData.connectionRate, 8), 100)}%` }}
                />
              </div>
            </div>

            {/* Stage 3: Appointments Set / Converted Leads */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-emerald-800">3. Appointments Set (CPL Basis)</span>
                <span className="font-mono text-emerald-700 font-bold">
                  {efficiencyData.totalAppointments} ({efficiencyData.appointmentSetRate.toFixed(1)}% ASR)
                </span>
              </div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(Math.max(efficiencyData.appointmentSetRate, 5), 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Cost Distribution Breakdown */}
        <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-cyan-600" />
            Cost Distribution
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80">
              <span className="text-slate-600 font-medium">Data &amp; Skip Trace</span>
              <span className="font-mono font-bold text-slate-900">${efficiencyData.skipTraceSpend.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80">
              <span className="text-slate-600 font-medium">Telephony Airtime</span>
              <span className="font-mono font-bold text-slate-900">${efficiencyData.telephonySpend.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80">
              <span className="text-slate-600 font-medium">Carrier &amp; Regulatory Fees</span>
              <span className="font-mono font-bold text-slate-900">${efficiencyData.carrierFees.toFixed(2)}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs font-bold">
            <span className="text-slate-800">Total Campaign Cost:</span>
            <span className="text-cyan-700 font-mono">${efficiencyData.totalSpend.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Per-Campaign Efficiency Comparison Table */}
      {campaigns.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-slate-600" />
              Campaign Benchmarks &amp; Efficiency Breakdown
            </h3>
            <span className="text-xs text-slate-500">
              Comparing {campaigns.length} active marketing channel{campaigns.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Campaign Name</th>
                  <th className="py-2.5 px-3">Target Market</th>
                  <th className="py-2.5 px-3 text-center">Dials</th>
                  <th className="py-2.5 px-3 text-center">Connect %</th>
                  <th className="py-2.5 px-3 text-center">Appointments</th>
                  <th className="py-2.5 px-3 text-right">Total Spend</th>
                  <th className="py-2.5 px-3 text-right">CPL</th>
                  <th className="py-2.5 px-3 text-right">ASR %</th>
                  <th className="py-2.5 px-3 text-center">Efficiency Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {campaignComparisons.map((c) => {
                  const isHighEfficiency = c.asr >= 15 || c.cpl < 30;
                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50/80 transition ${
                        currentCampaign?.id === c.id ? 'bg-cyan-50/30 font-medium' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-semibold text-slate-900 flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            c.status === 'active' ? 'bg-emerald-500' : 'bg-amber-400'
                          }`}
                        />
                        {c.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{c.target_market}</td>
                      <td className="py-2.5 px-3 text-center font-mono">{c.dials}</td>
                      <td className="py-2.5 px-3 text-center font-mono">{c.connectRate.toFixed(1)}%</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-700">
                        {c.appointments}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">${c.spend.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-cyan-700">
                        ${c.cpl.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                        {c.asr.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isHighEfficiency
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {isHighEfficiency ? 'High Yield' : 'Moderate Yield'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
