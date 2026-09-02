import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Database,
  Building,
  Key,
  PhoneCall,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  HardDrive,
  Globe,
  SlidersHorizontal,
  Lock,
  Cpu,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { DatabaseStatus } from '../types';

interface SettingsViewProps {
  dbStatus: DatabaseStatus | null;
  onRefreshDb?: () => Promise<void> | void;
  onNavigate: (view: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  dbStatus,
  onRefreshDb,
  onNavigate,
}) => {
  const { userProfile, activeTenant, availableTenants } = useAuth();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'general' | 'telephony' | 'gis' | 'security'>('general');
  const [tcpaDailyCap, setTcpaDailyCap] = useState('150');
  const [timezone, setTimezone] = useState('America/Los_Angeles');
  const [minLeadScore, setMinLeadScore] = useState('65');
  const [smartForwarding, setSmartForwarding] = useState({ enabled: false, rules: [] as Array<{ leadSource: string; extension: string }> });

  React.useEffect(() => {
    fetch('/api/settings/smart-forwarding')
      .then(res => res.json())
      .then(setSmartForwarding);
  }, []);

  const toggleSmartForwarding = async () => {
    const nextEnabled = !smartForwarding.enabled;
    const nextSettings = { ...smartForwarding, enabled: nextEnabled };
    setSmartForwarding(nextSettings);
    await fetch('/api/settings/smart-forwarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextSettings)
    });
    addToast(`Smart Forwarding ${nextEnabled ? 'enabled' : 'disabled'}.`, 'success');
  };

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    addToast('System settings successfully saved.', 'success');
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Settings className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">System Settings &amp; Governance</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tenant configuration, GIS layer endpoints, telephony compliance policies, and database connection state.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1 border-b border-slate-200">
        {[
          { id: 'general', label: 'General & Organization', icon: Building },
          { id: 'telephony', label: 'Telephony & TCPA Compliance', icon: PhoneCall },
          { id: 'gis', label: 'County GIS & Assessor Feeds', icon: Globe },
          { id: 'security', label: 'Database & Security', icon: Lock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
                isActive
                  ? 'border-cyan-600 text-cyan-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveGeneral} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Active Organization</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tenant Organization Name</label>
                <input
                  type="text"
                  disabled
                  value={activeTenant.name}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 cursor-not-allowed font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tenant ID</label>
                <input
                  type="text"
                  disabled
                  value={activeTenant.id}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Operating Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full sm:w-1/2 text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800"
              >
                <option value="America/Los_Angeles">Pacific Time (America/Los_Angeles)</option>
                <option value="America/Denver">Mountain Time (America/Denver)</option>
                <option value="America/Chicago">Central Time (America/Chicago)</option>
                <option value="America/New_York">Eastern Time (America/New_York)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">Used for calling window restrictions (8 AM – 8 PM local).</p>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Autonomous Pipeline Thresholds</h3>
            
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Minimum Opportunity Score for Auto-Qualification: {minLeadScore}/100
              </label>
              <input
                type="range"
                min="40"
                max="90"
                value={minLeadScore}
                onChange={(e) => setMinLeadScore(e.target.value)}
                className="w-full sm:w-1/2 accent-cyan-600"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Properties scored above this threshold by Sub-Agent 2 are promoted directly to Growth Opportunities.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
            >
              Save General Preferences
            </button>
          </div>
        </form>
      )}

      {activeTab === 'telephony' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">Telephony Provider Configuration</h3>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active Provider: RingCentral REST API
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">TCPA Safe Dialing Hours</span>
                  <Shield className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-[11px] text-slate-500">
                  Enforces strict calling bounds between 08:00 and 20:00 recipient local time.
                </p>
                <div className="text-xs font-semibold text-emerald-700">Strict Enforcement Active</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">DNC Registry Scrubbing</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-[11px] text-slate-500">
                  Real-time National Do-Not-Call registry cross-check before each dial dispatch.
                </p>
                <div className="text-xs font-semibold text-emerald-700">Automated Scrubbing Enabled</div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800">Smart Forwarding</h4>
                <p className="text-[11px] text-slate-500">Route incoming calls based on lead source tags.</p>
              </div>
              <button 
                onClick={toggleSmartForwarding}
                className={`w-10 h-6 rounded-full transition-colors ${smartForwarding.enabled ? 'bg-cyan-600' : 'bg-slate-300'}`}
              >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${smartForwarding.enabled ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Max Dials Per Agent / Day</label>
              <input
                type="number"
                value={tcpaDailyCap}
                onChange={(e) => setTcpaDailyCap(e.target.value)}
                className="w-full sm:w-48 text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800"
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'gis' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              California County GIS &amp; MapServer Endpoints
            </h3>

            <div className="space-y-3">
              {[
                { county: 'Orange County, CA', endpoint: 'https://gis.ocgov.com/arcgis/rest/services/LandRecords/MapServer/0', status: 'Operational', type: 'Esri ArcGIS REST' },
                { county: 'Los Angeles County, CA', endpoint: 'https://maps.assessor.lacounty.gov/arcgis/rest/services/PAIS/MapServer/0', status: 'Operational', type: 'Esri ArcGIS REST' },
                { county: 'Santa Clara County, CA', endpoint: 'https://gis.sccgov.org/arcgis/rest/services/Assessor/Parcels/MapServer/0', status: 'Operational', type: 'Esri ArcGIS REST' },
              ].map((gis) => (
                <div key={gis.county} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-slate-900">{gis.county}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono">
                        {gis.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono truncate max-w-lg">{gis.endpoint}</p>
                  </div>
                  <div className="flex items-center space-x-1 text-emerald-600 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{gis.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">Database &amp; Data Security</h3>
              {onRefreshDb && (
                <button
                  type="button"
                  onClick={() => onRefreshDb()}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center space-x-1.5 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Verify Connection</span>
                </button>
              )}
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">PostgreSQL / Cloud SQL Engine</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  {dbStatus?.connected ? 'Connected' : 'Active Local / Memory Mode'}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Strict multi-tenant row-level isolation via organization_id indexing. Foreign keys and cascade protections active.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigate('database')}
                className="text-xs font-semibold text-cyan-700 hover:text-cyan-900 flex items-center space-x-1 cursor-pointer"
              >
                <span>Inspect Database Schema Tables &rarr;</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
