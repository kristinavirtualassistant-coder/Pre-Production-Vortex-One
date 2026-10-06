import React, { useState } from 'react';
import { AlertCircle, Building2, Eye, EyeOff, KeyRound, Layers, Lock, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface AuthViewProps {
  onSuccess?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess }) => {
  const { signInWithEmail, signUpWithEmail, verifyMfa, requestPasswordReset, loading, error, clearError, mfaChallengeToken, verificationRequired } = useAuth();
  const { addToast } = useToast();
  const [mode, setMode] = useState<'signin' | 'signup' | 'mfa' | 'verify' | 'reset' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    const verify = params.get('verify');
    const reset = params.get('reset');
    if (invite) { setInviteToken(invite); setMode('signup'); }
    else if (verify) { setRecoveryToken(verify); setMode('verify'); }
    else if (reset) { setRecoveryToken(reset); setMode('reset'); }
  }, []);
  React.useEffect(() => { if (mfaChallengeToken) setMode('mfa'); }, [mfaChallengeToken]);
  React.useEffect(() => { if (verificationRequired) setMode('verify'); }, [verificationRequired]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearError();
    setSubmitting(true);
    try {
      if (mode === 'mfa') {
        await verifyMfa(mfaCode.trim());
        addToast('MFA verification successful.', 'success');
        onSuccess?.();
      } else if (mode === 'verify') {
        const response = await fetch('/api/auth/verify-email', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify({token:recoveryToken}) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Email verification failed');
        addToast('Email verified. You can now sign in.', 'success');
        setMode('signin');
      } else if (mode === 'reset') {
        if (recoveryPassword.length < 12) throw new Error('Password must be at least 12 characters.');
        const response = await fetch('/api/auth/password-reset/confirm', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify({token:recoveryToken,password:recoveryPassword}) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Password reset failed');
        addToast('Password reset successfully. Sign in with your new password.', 'success');
        setMode('signin');
      } else if (mode === 'forgot') {
        await requestPasswordReset(email.trim().toLowerCase());
        addToast('If the account exists, a password reset email has been sent.', 'success');
        setMode('signin');
      } else {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail || !password) throw new Error('Email and password are required.');
        if (password.length < 12) throw new Error('Password must be at least 12 characters.');
        if (mode === 'signin') {
          await signInWithEmail(normalizedEmail, password);
          if (!mfaChallengeToken) { addToast('Signed in successfully.', 'success'); onSuccess?.(); }
        } else {
          if (!name.trim() || (!organizationName.trim() && !inviteToken)) throw new Error('Name and organization are required.');
          await signUpWithEmail({ email:normalizedEmail, password, name:name.trim(), organizationName:organizationName.trim(), inviteToken:inviteToken || undefined });
          addToast('Account created. Check your email to verify the account.', 'success');
        }
      }
    } catch (err: any) { addToast(err?.message || 'Authentication failed.', 'error'); }
    finally { setSubmitting(false); }
  };

  return (
    <main className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <section className="w-full max-w-5xl grid gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-600/20 ring-1 ring-cyan-500/30">
              <Layers className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <div className="font-extrabold tracking-tight text-white">VORTEX ONE</div>
              <div className="text-xs text-slate-400">Property intelligence and operations platform</div>
            </div>
          </div>

          <div className="mt-10 space-y-5">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{mode === 'mfa' ? 'Verify your identity' : mode === 'verify' ? 'Verify your email' : mode === 'reset' ? 'Set a new password' : mode === 'forgot' ? 'Recover your account' : mode === 'signup' ? 'Create your workspace' : 'Secure workspace access'}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                PostgreSQL-backed identity, HttpOnly sessions, organization isolation, recovery controls, and optional MFA.
              </p>
            </div>
            <div className="grid gap-3 text-sm text-slate-300">
              <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3"><Lock className="h-4 w-4 text-cyan-400" /> HttpOnly server sessions</div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3"><ShieldCheck className="h-4 w-4 text-cyan-400" /> Email verification and MFA</div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3"><KeyRound className="h-4 w-4 text-cyan-400" /> Passwords protected with scrypt</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
          <div className="mb-6 flex rounded-xl border border-slate-800 bg-slate-950 p-1">
            <button type="button" onClick={() => { clearError(); setMode('signin'); }} className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'signin' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              Sign in
            </button>
            <button type="button" onClick={() => { clearError(); setMode('signup'); }} className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'signup' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              Create account
            </button>
          </div>

          {error && (
            <div className="mb-5 flex gap-2 rounded-xl border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'mfa' && <p className="mb-5 text-sm text-slate-400">Enter the six-digit authenticator code. A backup code can also be used.</p>}
          {mode === 'verify' && <p className="mb-5 text-sm text-slate-400">Use the verification link sent to your email.</p>}
          {mode === 'forgot' && <p className="mb-5 text-sm text-slate-400">Enter your email. The response is the same whether an account exists or not.</p>}
          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <label className="block text-sm text-slate-300">
                  Name
                  <div className="mt-1 flex items-center rounded-xl border border-slate-700 bg-slate-950 px-3">
                    <UserRound className="h-4 w-4 text-slate-500" />
                    <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-transparent px-3 py-3 outline-none" autoComplete="name" required />
                  </div>
                </label>
                <label className="block text-sm text-slate-300">
                  Organization name
                  <div className="mt-1 flex items-center rounded-xl border border-slate-700 bg-slate-950 px-3">
                    <Building2 className="h-4 w-4 text-slate-500" />
                    <input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} placeholder="Your company or organization" className="w-full bg-transparent px-3 py-3 outline-none" autoComplete="organization" required={!inviteToken} disabled={!!inviteToken} />
                  </div>
                  {inviteToken && <span className="mt-1 block text-xs text-cyan-400">You are joining an existing Vortex One tenant.</span>}
                </label>
              </>
            )}

            <label className="block text-sm text-slate-300">
              Email
              <div className="mt-1 flex items-center rounded-xl border border-slate-700 bg-slate-950 px-3">
                <Mail className="h-4 w-4 text-slate-500" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent px-3 py-3 outline-none" autoComplete="email" required />
              </div>
            </label>

            <label className="block text-sm text-slate-300">
              Password
              <div className="mt-1 flex items-center rounded-xl border border-slate-700 bg-slate-950 px-3">
                <KeyRound className="h-4 w-4 text-slate-500" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-transparent px-3 py-3 outline-none" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="p-1 text-slate-500 hover:text-slate-200" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <span className="mt-1 block text-xs text-slate-500">Minimum 12 characters.</span>
            </label>

            {mode === 'mfa' && <label className="block text-sm text-slate-300">Authenticator or backup code<input inputMode="numeric" autoComplete="one-time-code" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 outline-none" required /></label>}
            {mode === 'reset' && <label className="block text-sm text-slate-300">New password<input type="password" autoComplete="new-password" value={recoveryPassword} onChange={(e) => setRecoveryPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 outline-none" required /></label>}
            {(mode === 'verify' || mode === 'reset') && <label className="block text-sm text-slate-300">Verification/reset token<input value={recoveryToken} onChange={(e) => setRecoveryToken(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 outline-none" required /></label>}
            <button type="submit" disabled={submitting || loading} className="w-full rounded-xl bg-cyan-600 px-4 py-3 font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting || loading ? 'Processing…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'mfa' ? 'Verify MFA' : mode === 'verify' ? 'Verify email' : mode === 'reset' ? 'Reset password' : 'Send recovery email'}
            </button>
          </form>
          {mode === 'signin' && <div className="mt-4 flex justify-between text-xs"><button type="button" onClick={() => setMode('forgot')} className="text-cyan-400 hover:text-cyan-300">Forgot password?</button><button type="button" onClick={() => setMode('verify')} className="text-slate-400 hover:text-white">Verify email</button></div>}
          {(mode === 'mfa' || mode === 'verify' || mode === 'reset' || mode === 'forgot') && <button type="button" onClick={() => setMode('signin')} className="mt-4 text-xs text-slate-400 hover:text-white">Back to sign in</button>}
        </div>
      </section>
    </main>
  );
};
