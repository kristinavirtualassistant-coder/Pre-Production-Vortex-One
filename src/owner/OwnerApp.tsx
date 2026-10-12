import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Activity, Building2, DatabaseBackup, LayoutDashboard, LogOut, ScrollText, Settings, ShieldAlert, ShieldCheck, Users, BarChart3, LifeBuoy } from 'lucide-react';
import { OwnerApiError, authPost, onSessionExpired, ownerPost, ownerProbe, type OwnerSession } from './api';
import { useOwnerPath } from './router';
import { Loading, primaryButton, secondaryButton } from './ui';
import LoginPage from './pages/LoginPage';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Organizations = lazy(() => import('./pages/Organizations'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const Usage = lazy(() => import('./pages/Usage'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const SystemPage = lazy(() => import('./pages/System'));
const Backups = lazy(() => import('./pages/Backups'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

const NAV = [
  { to: '/owner', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/owner/organizations', label: 'Organizations', icon: Building2 },
  { to: '/owner/users', label: 'Users', icon: Users },
  { to: '/owner/usage', label: 'Usage', icon: BarChart3 },
  { to: '/owner/audit-logs', label: 'Audit logs', icon: ScrollText },
  { to: '/owner/system', label: 'System', icon: Activity },
  { to: '/owner/backups', label: 'Backups', icon: DatabaseBackup },
  { to: '/owner/settings', label: 'Settings', icon: Settings },
];

type Phase = { kind: 'loading' } | { kind: 'anon'; expired?: boolean } | { kind: 'denied'; reason: 'forbidden' | 'mfa' } | { kind: 'ready'; session: OwnerSession };

/** Owner Portal root: an auth gate in front of a separate shell. The server decides; this only reflects its answer. */
export default function OwnerApp() {
  const { path, navigate } = useOwnerPath();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });

  const refreshSession = useCallback(async () => {
    try {
      const session = await ownerProbe<OwnerSession>('/api/owner/session');
      setPhase({ kind: 'ready', session });
    } catch (e) {
      if (e instanceof OwnerApiError && e.status === 401) setPhase({ kind: 'anon' });
      else if (e instanceof OwnerApiError && e.status === 403) setPhase({ kind: 'denied', reason: e.code === 'MFA_REQUIRED' ? 'mfa' : 'forbidden' });
      else setPhase({ kind: 'anon' });
    }
  }, []);

  useEffect(() => { void refreshSession(); }, [refreshSession]);
  useEffect(() => onSessionExpired(() => { setPhase({ kind: 'anon', expired: true }); navigate('/owner/login?expired=1', true); }), [navigate]);

  // Unauthenticated visitors of any /owner/* page are sent to /owner/login; authenticated owners leave the login page.
  useEffect(() => {
    if (phase.kind === 'anon' && path !== '/owner/login') navigate('/owner/login', true);
    if (phase.kind === 'ready' && path === '/owner/login') navigate('/owner', true);
  }, [phase, path, navigate]);

  const signOut = useCallback(async () => {
    await authPost('/api/auth/logout', {}).catch(() => undefined);
    setPhase({ kind: 'anon' });
    navigate('/owner/login', true);
  }, [navigate]);

  if (phase.kind === 'loading') return <div className="min-h-screen bg-slate-950 px-6"><Loading label="Checking access…" /></div>;

  if (phase.kind === 'anon' || (phase.kind === 'denied' && path === '/owner/login')) {
    return <LoginPage expired={window.location.search.includes('expired=1')} onAuthenticated={(session) => { setPhase({ kind: 'ready', session }); navigate('/owner', true); }} />;
  }

  if (phase.kind === 'denied') {
    // No dashboard, no owner navigation: only a neutral refusal.
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div role="alert" className="max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-amber-400" aria-hidden />
          <h1 className="mt-3 text-lg font-semibold text-white">{phase.reason === 'mfa' ? 'Multi-factor authentication required' : 'Access denied'}</h1>
          <p className="mt-2 text-sm text-slate-400">{phase.reason === 'mfa' ? 'Enable MFA on your account and sign in again with your authenticator code.' : 'This area is restricted to the Vortex One platform operator.'}</p>
          <div className="mt-5 flex justify-center gap-2">
            <a href="/" className={secondaryButton}>Back to Vortex One</a>
            <button onClick={signOut} className={primaryButton}>Sign out</button>
          </div>
        </div>
      </main>
    );
  }

  const { session } = phase;
  const support = session.supportSession;
  const page: ReactNode = (() => {
    if (path === '/owner') return <Dashboard navigate={navigate} />;
    if (path === '/owner/organizations' || path.startsWith('/owner/organizations/')) return <Organizations path={path} navigate={navigate} supportOrgId={support?.organization_id} onSessionChanged={refreshSession} />;
    if (path === '/owner/users') return <UsersPage />;
    if (path === '/owner/usage') return <Usage />;
    if (path === '/owner/audit-logs') return <AuditLogs />;
    if (path === '/owner/system') return <SystemPage />;
    if (path === '/owner/backups') return <Backups />;
    if (path === '/owner/settings') return <SettingsPage />;
    return <div className="py-16 text-center text-slate-400">Page not found. <a className="text-cyan-300 underline" href="/owner" onClick={(e) => { e.preventDefault(); navigate('/owner'); }}>Back to dashboard</a></div>;
  })();

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <a href="#owner-main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-cyan-600 focus:px-3 focus:py-2">Skip to content</a>
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-900 md:flex" aria-label="Owner navigation">
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-4"><ShieldCheck className="h-5 w-5 text-cyan-400" aria-hidden /><div><p className="text-sm font-semibold text-white">Vortex One</p><p className="text-[11px] uppercase tracking-wider text-amber-400">Owner Portal</p></div></div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = to === '/owner' ? path === '/owner' : path === to || path.startsWith(`${to}/`);
            return <a key={to} href={to} aria-current={active ? 'page' : undefined} onClick={(e) => { e.preventDefault(); navigate(to); }}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${active ? 'bg-cyan-600/20 text-cyan-200' : 'text-slate-300 hover:bg-slate-800'}`}><Icon className="h-4 w-4" aria-hidden />{label}</a>;
          })}
        </nav>
        <div className="border-t border-slate-800 p-3 text-xs text-slate-400"><p className="truncate" title={session.owner.email}>{session.owner.email}</p><p className="mt-1 inline-flex items-center gap-1 text-amber-300"><ShieldCheck className="h-3 w-3" aria-hidden />Platform owner{session.owner.mfaVerified ? ' · MFA' : ''}</p></div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {support && <SupportBanner session={support} navigate={navigate} onEnded={refreshSession} />}
        <header className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/60 px-4 py-3">
          <nav className="flex gap-1 overflow-x-auto md:hidden" aria-label="Owner navigation (compact)">
            {NAV.map(({ to, label }) => <a key={to} href={to} onClick={(e) => { e.preventDefault(); navigate(to); }} aria-current={path === to ? 'page' : undefined} className={`whitespace-nowrap rounded px-2 py-1 text-xs ${path === to ? 'bg-cyan-600/20 text-cyan-200' : 'text-slate-300'}`}>{label}</a>)}
          </nav>
          <span className="hidden text-xs text-slate-500 md:block">Internal control plane — all actions are audited</span>
          <button onClick={signOut} className={`${secondaryButton} whitespace-nowrap`}><LogOut className="h-4 w-4" aria-hidden />Sign out</button>
        </header>
        <main id="owner-main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6"><Suspense fallback={<Loading />}>{page}</Suspense></main>
      </div>
    </div>
  );
}

function SupportBanner({ session, navigate, onEnded }: { session: NonNullable<OwnerSession['supportSession']>; navigate: (p: string) => void; onEnded: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const remaining = Math.max(0, Math.floor((new Date(session.expires_at).getTime() - now) / 1000));
  useEffect(() => { if (remaining === 0) onEnded(); }, [remaining, onEnded]);
  const end = async () => { await ownerPost('/api/owner/support/end').catch(() => undefined); onEnded(); };
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950">
      <span className="inline-flex items-center gap-2"><LifeBuoy className="h-4 w-4" aria-hidden />SUPPORT MODE — {session.organization_name} — {String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')} left</span>
      <span className="flex gap-2">
        <button onClick={() => navigate(`/owner/organizations/${session.organization_id}`)} className="rounded bg-slate-950/10 px-2 py-1 hover:bg-slate-950/20">Open organization</button>
        <button onClick={end} className="rounded bg-slate-950 px-2 py-1 text-amber-300 hover:bg-slate-800">Exit support mode</button>
      </span>
    </div>
  );
}
