import React, { useEffect, useState } from 'react';
import { ShieldCheck, Smartphone, Monitor, LogOut, Copy, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export const AccountSecurityPanel: React.FC = () => {
  const { userProfile, getAuthHeaders } = useAuth();
  const { addToast } = useToast();
  const [sessions, setSessions] = useState<any[]>([]);
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaUri, setMfaUri] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const response = await fetch('/api/auth/sessions', { credentials: 'include', headers: getAuthHeaders() });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setSessions(data.sessions || []);
  };

  useEffect(() => { load().catch(() => undefined); }, [getAuthHeaders]);

  const startMfa = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/mfa/setup', { method: 'POST', credentials: 'include', headers: getAuthHeaders() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to start MFA setup');
      setMfaSecret(data.secret);
      setMfaUri(data.otpauthUri);
    } catch (error: any) { addToast(error.message || 'Unable to start MFA setup', 'error'); }
    finally { setLoading(false); }
  };

  const enableMfa = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/mfa/enable', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ code: mfaCode }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to enable MFA');
      setBackupCodes(data.backupCodes || []);
      setMfaSecret('');
      setMfaUri('');
      setMfaCode('');
      addToast('MFA enabled.', 'success');
    } catch (error: any) { addToast(error.message || 'Unable to enable MFA', 'error'); }
    finally { setLoading(false); }
  };

  const revokeOthers = async () => {
    const response = await fetch('/api/auth/sessions/revoke-others', { method: 'POST', credentials: 'include', headers: getAuthHeaders() });
    if (!response.ok) { addToast('Unable to revoke other sessions.', 'error'); return; }
    await load();
    addToast('Other sessions revoked.', 'success');
  };

  const copyCodes = async () => {
    await navigator.clipboard.writeText(backupCodes.join('\n'));
    addToast('Backup codes copied.', 'success');
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Multi-factor authentication</h3>
            <p className="text-[11px] text-slate-500 mt-1">TOTP authenticator with single-use recovery codes.</p>
          </div>
          {userProfile?.mfaEnabled || backupCodes.length > 0 ? <span className="text-xs font-semibold text-emerald-700">Enabled</span> : <span className="text-xs text-slate-500">Not enabled</span>}
        </div>
        {!userProfile?.mfaEnabled && backupCodes.length === 0 && !mfaSecret && <button type="button" onClick={startMfa} disabled={loading} className="mt-3 px-3 py-2 rounded-lg bg-cyan-600 text-white text-xs font-semibold">{loading ? 'Preparing…' : 'Set up authenticator MFA'}</button>}
        {!userProfile?.mfaEnabled && mfaSecret && (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg bg-slate-50 p-3 text-xs"><div className="font-semibold">Manual setup secret</div><code className="font-mono break-all">{mfaSecret}</code></div>
            <div className="rounded-lg bg-slate-50 p-3 text-[11px] break-all"><strong>Authenticator URI:</strong> {mfaUri}</div>
            <div className="flex gap-2">
              <input value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg" />
              <button type="button" onClick={enableMfa} disabled={!/^\d{6}$/.test(mfaCode) || loading} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold">Enable</button>
            </div>
          </div>
        )}
        {backupCodes.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center justify-between"><strong className="text-xs text-amber-900">Save your backup codes</strong><button type="button" onClick={copyCodes} className="text-xs text-amber-800 flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</button></div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2">{backupCodes.map(code => <code key={code} className="text-xs font-mono text-amber-900">{code}</code>)}</div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div><h3 className="text-sm font-bold text-slate-900">Sessions and devices</h3><p className="text-[11px] text-slate-500 mt-1">Review active sessions and revoke all other devices.</p></div>
          <button type="button" onClick={revokeOthers} className="px-3 py-2 rounded-lg border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1"><LogOut className="w-3 h-3" /> Revoke others</button>
        </div>
        <div className="mt-4 space-y-2">
          {sessions.map(session => (
            <div key={session.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-[11px]">
              <div className="flex items-center gap-2"><Monitor className="w-4 h-4 text-slate-400" /><span>{session.user_agent || 'Unknown device'}<br /><span className="text-slate-400">{session.ip_address || 'Unknown IP'}</span></span></div>
              <span className={session.current ? 'font-semibold text-emerald-700' : 'text-slate-500'}>{session.current ? 'Current' : new Date(session.last_seen_at).toLocaleString()}</span>
            </div>
          ))}
          {!sessions.length && <div className="text-xs text-slate-400">No active sessions returned.</div>}
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 flex gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>Session credentials are stored server-side as one-way hashes and delivered to the browser only through an HttpOnly cookie.</span>
      </div>
    </div>
  );
};
