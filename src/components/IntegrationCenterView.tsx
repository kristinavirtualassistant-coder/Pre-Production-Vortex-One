import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Blocks,
  CheckCircle2,
  Circle,
  Link2,
  LogIn,
  Unplug,
  Search,
  ShieldCheck,
} from 'lucide-react';

type IntegrationCategory = 'AI' | 'Communications' | 'CRM' | 'Productivity' | 'Storage' | 'Data' | 'Identity';

type Integration = {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  auth: 'oauth' | 'api_key' | 'account';
  supportsGoogle: boolean;
  supportsMicrosoft: boolean;
};

const INTEGRATIONS: Integration[] = [
  { id: 'google-workspace', name: 'Google Workspace', description: 'Connect Drive, Sheets, Calendar, Gmail, and Google identity.', category: 'Productivity', auth: 'oauth', supportsGoogle: true, supportsMicrosoft: false },
  { id: 'microsoft-365', name: 'Microsoft 365', description: 'Connect Outlook, OneDrive, Calendar, Excel, and Microsoft identity.', category: 'Productivity', auth: 'oauth', supportsGoogle: false, supportsMicrosoft: true },
  { id: 'ringcentral', name: 'RingCentral', description: 'Connect calling, messaging, telephony events, and campaign operations.', category: 'Communications', auth: 'account', supportsGoogle: true, supportsMicrosoft: true },
  { id: 'openai', name: 'OpenAI', description: 'Connect OpenAI models and services for agent execution.', category: 'AI', auth: 'api_key', supportsGoogle: false, supportsMicrosoft: false },
  { id: 'gemini', name: 'Google Gemini', description: 'Connect Gemini models for reasoning, research, and generation.', category: 'AI', auth: 'api_key', supportsGoogle: true, supportsMicrosoft: false },
  { id: 'slack', name: 'Slack', description: 'Send notifications, route approvals, and surface operational activity.', category: 'Communications', auth: 'oauth', supportsGoogle: true, supportsMicrosoft: true },
  { id: 'hubspot', name: 'HubSpot', description: 'Sync contacts, companies, deals, and CRM activity.', category: 'CRM', auth: 'oauth', supportsGoogle: true, supportsMicrosoft: true },
  { id: 'salesforce', name: 'Salesforce', description: 'Connect enterprise CRM records, activities, and workflows.', category: 'CRM', auth: 'oauth', supportsGoogle: true, supportsMicrosoft: true },
];

const CATEGORY_ORDER: IntegrationCategory[] = ['AI', 'Communications', 'CRM', 'Productivity', 'Storage', 'Data', 'Identity'];

const authLabel = (auth: Integration['auth']) =>
  auth === 'oauth' ? 'OAuth / Account Sign-In' : auth === 'api_key' ? 'Provider API Key' : 'Connected Account';

export const IntegrationCenterView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | IntegrationCategory>('all');
  const [connections, setConnections] = useState<Record<string, { account_email?: string; status: string }>>({});
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { getAuthHeaders } = useAuth();

  const loadConnections = async () => {
    const response = await fetch('/api/integrations', { headers: getAuthHeaders() });
    if (!response.ok) return;
    const data = await response.json();
    setConnections(Object.fromEntries((data.connections || []).map((connection: { provider: string; account_email?: string; status: string }) => [connection.provider, connection])));
  };

  useEffect(() => {
    void loadConnections();
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error = params.get('integrationError');
    if (connected) setMessage(`${connected} connected successfully.`);
    if (error) setMessage(error);
  }, []);

  const connect = async (provider: string) => {
    setBusyProvider(provider);
    setMessage(null);
    try {
      const response = await fetch(`/api/integrations/oauth/start/${provider}`, { headers: getAuthHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'OAuth connection could not start');
      window.location.assign(data.authorizationUrl);
    } catch (error: any) {
      setMessage(error.message || 'OAuth connection could not start');
      setBusyProvider(null);
    }
  };

  const disconnect = async (provider: string) => {
    setBusyProvider(provider);
    try {
      const response = await fetch(`/api/integrations/${provider}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Disconnect failed');
      await loadConnections();
      setMessage('Integration disconnected.');
    } catch (error: any) {
      setMessage(error.message || 'Disconnect failed');
    } finally {
      setBusyProvider(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return INTEGRATIONS.filter((integration) => {
      const categoryMatch = category === 'all' || integration.category === category;
      const queryMatch = !q || [integration.name, integration.description, integration.category].some((value) => value.toLowerCase().includes(q));
      return categoryMatch && queryMatch;
    });
  }, [query, category]);

  return (
    <div className='p-6 max-w-6xl mx-auto space-y-6'>
      <div className='flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4'>
        <div>
          <div className='flex items-center gap-2.5'>
            <div className='w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center'>
              <Blocks className='w-5 h-5 text-cyan-700' />
            </div>
            <div>
              <h1 className='text-xl font-bold text-slate-900 tracking-tight'>Integration Center</h1>
              <p className='text-xs text-slate-500 mt-0.5'>Connect external apps only when you have an account. Integrations remain optional to the core platform.</p>
            </div>
          </div>
        </div>
        <div className='flex items-center gap-2 text-[11px] text-slate-600'>
          <ShieldCheck className='w-4 h-4 text-emerald-600' />
          <span>External services are optional integrations.</span>
        </div>
      </div>

      <div className='bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4'>
        <div className='flex flex-col md:flex-row gap-3'>
          <div className='relative flex-1'>
            <Search className='w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2' />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder='Search apps, software, or integration types...' className='w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-cyan-100' />
          </div>
          <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className='md:w-52 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800'>
            <option value='all'>All categories</option>
            {CATEGORY_ORDER.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className='flex flex-wrap gap-2'>
          {CATEGORY_ORDER.map((item) => (
            <button key={item} onClick={() => setCategory(category === item ? 'all' : item)} className={'px-3 py-1.5 rounded-full text-[11px] font-semibold border transition ' + (category === item ? 'bg-cyan-50 border-cyan-200 text-cyan-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300')}>{item}</button>
          ))}
        </div>
      </div>

      {message && <div className='bg-cyan-50 border border-cyan-200 text-cyan-900 rounded-xl px-4 py-3 text-xs'>{message}</div>}

      <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
        {filtered.map((integration) => {
          const connection = connections[integration.id];
          const isConnected = connection?.status === 'connected';
          return (
            <div key={integration.id} className='bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col'>
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <div className='flex items-center gap-2'>
                    <h2 className='text-sm font-bold text-slate-900'>{integration.name}</h2>
                    {isConnected ? <CheckCircle2 className='w-4 h-4 text-emerald-600' /> : <Circle className='w-4 h-4 text-slate-300' />}
                  </div>
                  <span className='inline-flex mt-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold'>{integration.category}</span>
                </div>
                <Link2 className='w-4 h-4 text-slate-400' />
              </div>
              <p className='mt-3 text-xs leading-relaxed text-slate-600 flex-1'>{integration.description}</p>
              <div className='mt-4 pt-3 border-t border-slate-100 space-y-3'>
                <div className='flex items-center justify-between text-[10px] text-slate-500'><span>{authLabel(integration.auth)}</span><span className='font-semibold text-slate-700'>{integration.supportsGoogle && integration.supportsMicrosoft ? 'Google or Microsoft' : integration.supportsGoogle ? 'Google sign-in' : integration.supportsMicrosoft ? 'Microsoft sign-in' : 'Provider account'}</span></div>
                {integration.auth === 'oauth' ? (
                  <button type='button' onClick={() => isConnected ? void disconnect(integration.id) : void connect(integration.id)} disabled={busyProvider === integration.id} className={'w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ' + (isConnected ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-cyan-600 text-white hover:bg-cyan-700')}>
                    {isConnected ? <Unplug className='w-3.5 h-3.5' /> : <LogIn className='w-3.5 h-3.5' />}
                    {busyProvider === integration.id ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect Account'}
                  </button>
                ) : (
                  <button type='button' disabled className='w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-500 cursor-not-allowed'>
                    <LogIn className='w-3.5 h-3.5' />
                    Configure Integration
                  </button>
                )}
                {connection?.account_email && <p className='text-[10px] text-emerald-700'>Connected as {connection.account_email}</p>}
                <p className='text-[10px] text-slate-400'>OAuth uses a server-side authorization-code flow with PKCE. Tokens never enter browser storage.</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};