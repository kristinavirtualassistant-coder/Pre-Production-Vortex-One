import React, { useState } from 'react';
import { AlertCircle, Building2, Eye, EyeOff, KeyRound, Layers, Lock, Mail, UserRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface AuthViewProps {
  onSuccess?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess }) => {
  const { signInWithEmail, signUpWithEmail, loading, error, clearError } = useAuth();
  const { addToast } = useToast();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearError();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      addToast('Email and password are required.', 'error');
      return;
    }
    if (mode === 'signup' && (!name.trim() || !organizationName.trim())) {
      addToast('Name and organization are required.', 'error');
      return;
    }
    if (password.length < 12) {
      addToast('Password must be at least 12 characters.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(normalizedEmail, password);
        addToast('Signed in successfully.', 'success');
      } else {
        await signUpWithEmail({
          email: normalizedEmail,
          password,
          name: name.trim(),
          organizationName: organizationName.trim(),
        });
        addToast('Account created and signed in successfully.', 'success');
      }
      onSuccess?.();
    } catch {
      // AuthContext owns the user-facing error state.
    } finally {
      setSubmitting(false);
    }
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
              <h1 className="text-3xl font-bold tracking-tight">Secure workspace access</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Authentication, organization membership, sessions, and application persistence are controlled by PostgreSQL.
              </p>
            </div>
            <div className="grid gap-3 text-sm text-slate-300">
              <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3"><Lock className="h-4 w-4 text-cyan-400" /> PostgreSQL-backed sessions</div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3"><Building2 className="h-4 w-4 text-cyan-400" /> Canonical organization membership</div>
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
                    <input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} placeholder="Your company or organization" className="w-full bg-transparent px-3 py-3 outline-none" autoComplete="organization" required />
                  </div>
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

            <button type="submit" disabled={submitting || loading} className="w-full rounded-xl bg-cyan-600 px-4 py-3 font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting || loading ? 'Authenticating…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
};
