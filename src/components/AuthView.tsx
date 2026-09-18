import React, { useState } from 'react';
import { AlertCircle, ArrowRight, Building2, Eye, EyeOff, Layers, Lock, Mail, User } from 'lucide-react';
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

  const selectMode = (nextMode: 'signin' | 'signup') => {
    clearError();
    setMode(nextMode);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearError();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      addToast('Email and password are required.', 'error');
      return;
    }
    if (mode === 'signup' && (!name.trim() || !organizationName.trim())) {
      addToast('Name and organization are required to create an account.', 'error');
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
      // AuthContext exposes the server error in the error banner.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <div className="font-extrabold tracking-tight text-xl">VORTEX ONE</div>
                <div className="text-xs text-cyan-400 uppercase tracking-wider font-semibold">PostgreSQL Security Gateway</div>
              </div>
            </div>
            <h1 className="text-3xl font-bold leading-tight">Property intelligence, CRM, campaigns, and operations in one system.</h1>
            <p className="mt-4 text-sm text-slate-400 leading-6">
              Vortex One uses PostgreSQL as its authoritative identity and application data store. Authentication is required for application access.
            </p>
          </div>
          <div className="mt-10 grid gap-3 text-sm text-slate-300">
            <div className="flex items-center gap-3"><Lock className="w-4 h-4 text-cyan-400" />Secure server-side sessions</div>
            <div className="flex items-center gap-3"><Building2 className="w-4 h-4 text-cyan-400" />Organization-scoped tenant isolation</div>
            <div className="flex items-center gap-3"><ArrowRight className="w-4 h-4 text-cyan-400" />No guest, demo, or provider bypass</div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 mb-6">
            <button type="button" onClick={() => selectMode('signin')} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${mode === 'signin' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>Sign In</button>
            <button type="button" onClick={() => selectMode('signup')} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${mode === 'signup' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>Create Account</button>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-rose-800 bg-rose-950/60 p-3 text-sm text-rose-200 flex gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-300">Your name</span>
                  <div className="mt-1 relative"><User className="absolute left-3 top-3 w-4 h-4 text-slate-500" /><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-cyan-500" /></div>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-300">Organization</span>
                  <div className="mt-1 relative"><Building2 className="absolute left-3 top-3 w-4 h-4 text-slate-500" /><input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} autoComplete="organization" className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-cyan-500" /></div>
                </label>
              </>
            )}
            <label className="block">
              <span className="text-xs font-semibold text-slate-300">Email</span>
              <div className="mt-1 relative"><Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-cyan-500" /></div>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-300">Password</span>
              <div className="mt-1 relative"><Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-10 text-sm outline-none focus:border-cyan-500" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>
              <span className="mt-1 block text-[11px] text-slate-500">Minimum 12 characters.</span>
            </label>
            <button type="submit" disabled={submitting || loading} className="w-full rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 py-2.5 text-sm font-semibold transition">
              {submitting || loading ? 'Processing…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
};
