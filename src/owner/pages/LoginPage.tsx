import { useState, type FormEvent } from 'react';
import { KeyRound, Lock, Mail, ShieldAlert, ShieldCheck } from 'lucide-react';
import { OwnerApiError, authPost, ownerPost, ownerProbe, type OwnerSession } from '../api';
import { Field, inputClass, primaryButton } from '../ui';

/**
 * Owner sign-in. It uses the platform's existing authentication endpoints (same credentials, same MFA); there is NO
 * sign-up, registration, invitation or password-reset affordance here. Whether the account may enter the portal is
 * decided by the server (/api/owner/session), never by this page.
 */
export default function LoginPage({ expired, onAuthenticated }: { expired?: boolean; onAuthenticated: (s: OwnerSession) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    try {
      const session = await ownerProbe<OwnerSession>('/api/owner/session');
      await ownerPost('/api/owner/session/start').catch(() => undefined);
      onAuthenticated(session);
    } catch (e) {
      // The account is a valid user but not the platform owner (or lacks MFA): end the session we just created.
      await authPost('/api/auth/logout', {}).catch(() => undefined);
      setChallenge(null); setPassword(''); setCode('');
      if (e instanceof OwnerApiError && e.code === 'MFA_REQUIRED') setError('Multi-factor authentication must be enabled and completed for this portal.');
      else setError('This account is not authorized to use the Owner Portal.');
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null);
    try {
      if (!challenge) {
        const result = await authPost<{ mfaRequired?: boolean; challengeToken?: string }>('/api/auth/login', { email: email.trim(), password });
        if (result.mfaRequired && result.challengeToken) { setChallenge(result.challengeToken); setPassword(''); return; }
        await finish();
      } else {
        await authPost('/api/auth/mfa/verify', { challengeToken: challenge, code: code.trim() });
        await finish();
      }
    } catch (e) {
      setError(e instanceof OwnerApiError && e.status === 429 ? 'Too many attempts. Wait a few minutes and try again.' : e instanceof OwnerApiError && e.status !== 0 && e.status < 500 ? 'Sign-in failed. Check your details and try again.' : 'Sign-in is unavailable right now.');
      if (challenge) setCode('');
    } finally { setBusy(false); }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-600/20 text-cyan-300"><ShieldCheck className="h-6 w-6" aria-hidden /></div>
          <h1 className="text-xl font-semibold text-white">Vortex One Owner Portal</h1>
          <p className="mt-1 text-sm text-slate-400">Restricted. Authorized platform operator only.</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-5" aria-describedby={error ? 'owner-login-error' : undefined}>
          {expired && !error && <p role="status" className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Your session expired. Sign in again.</p>}
          {error && <p id="owner-login-error" role="alert" className="flex gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{error}</p>}
          {!challenge ? (
            <>
              <Field label="Email">{(id) => <div className="relative"><Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" aria-hidden /><input id={id} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} pl-9`} /></div>}</Field>
              <Field label="Password">{(id) => <div className="relative"><Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" aria-hidden /><input id={id} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} pl-9`} /></div>}</Field>
            </>
          ) : (
            <Field label="Authenticator code" hint="Enter the 6-digit code, or a backup code.">{(id) => <div className="relative"><KeyRound className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" aria-hidden /><input id={id} inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} className={`${inputClass} pl-9`} /></div>}</Field>
          )}
          <button type="submit" disabled={busy} className={`${primaryButton} w-full`}>{busy ? 'Verifying…' : challenge ? 'Verify and continue' : 'Sign in'}</button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-500">Access is provisioned by the platform operator. Activity is logged.</p>
      </div>
    </main>
  );
}
