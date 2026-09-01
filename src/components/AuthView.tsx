import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  Building,
  KeyRound,
  ArrowRight,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Briefcase,
  Users,
  ChevronRight,
  Database,
  Radio,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { DEMO_USERS } from '../lib/firebase';
import { useToast } from '../contexts/ToastContext';

interface AuthViewProps {
  onSuccess?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess }) => {
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signInAsDemoPersona,
    continueAsGuest,
    loading,
    error,
    clearError,
  } = useAuth();
  const { addToast } = useToast();

  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'demo'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('CMC Realty & Property Management');
  const [role, setRole] = useState<'admin' | 'executive' | 'manager' | 'agent'>('executive');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGuestExplore = () => {
    continueAsGuest();
    addToast('Welcome! Exploring Vortex One in guest mode. Sign-in is completely optional.', 'info');
    onSuccess?.();
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      addToast('Please provide both email and password.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await signInWithEmail(email, password);
      addToast('Signed in successfully! Loading tenant workspace...', 'success');
      onSuccess?.();
    } catch (err: any) {
      // Error handled in AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || !name.trim()) {
      addToast('Please fill out all required registration fields.', 'error');
      return;
    }
    if (password.length < 6) {
      addToast('Password must be at least 6 characters.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await signUpWithEmail({
        email,
        password,
        name,
        organizationName: orgName,
        role,
      });
      addToast(`Account created for ${name}! Welcome to Vortex One.`, 'success');
      onSuccess?.();
    } catch (err: any) {
      // Error handled in AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
      addToast('Google authentication successful! Workspace ready.', 'success');
      onSuccess?.();
    } catch (err: any) {
      // Error handled in AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoSignIn = async (personaId: string) => {
    setIsSubmitting(true);
    try {
      await signInAsDemoPersona(personaId);
      const persona = DEMO_USERS.find((u) => u.id === personaId);
      addToast(`Logged in as ${persona?.name || 'Verified Persona'} (${persona?.role?.toUpperCase()}).`, 'success');
      onSuccess?.();
    } catch (err: any) {
      addToast('Failed to sign in with demo persona.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between overflow-y-auto selection:bg-cyan-500 selection:text-white">
      {/* Background Decorative Gradients */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-600/30 rounded-full blur-3xl transform -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/30 rounded-full blur-3xl transform translate-y-1/2"></div>
      </div>

      {/* Top Header Bar */}
      <header className="relative z-10 w-full border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-white/10">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-xl tracking-tight text-white">VORTEX ONE</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                Security Gateway
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Enterprise Property Intelligence &amp; Multi-Agent OS</p>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs text-slate-400">
          <button
            type="button"
            onClick={handleGuestExplore}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold transition cursor-pointer"
          >
            <span>Skip Sign-In / Explore Platform</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-300 font-medium">Auth Optional</span>
          </div>
        </div>
      </header>

      {/* Main Authentication Grid */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Left Column: Platform Mission & Multi-Tenant Highlights */}
          <div className="lg:col-span-5 flex flex-col justify-between p-8 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800 shadow-2xl backdrop-blur-md">
            <div className="space-y-6">
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Multi-Tenant Enterprise Cloud</span>
              </div>

              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white leading-tight">
                  Autonomous Intelligence for Commercial Real Estate
                </h1>
                <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                  Authenticate to access multi-agent property discovery, California cadastral deed research, skip tracing intelligence, and multi-line outbound campaign pipelines.
                </p>
              </div>

              {/* Security Features */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-md bg-cyan-950 border border-cyan-800/50 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-xs font-semibold text-slate-200">Strict Tenant Data Isolation</h2>
                    <p className="text-[11px] text-slate-400">Properties, leads, and recordings are cryptographically isolated per organization.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-md bg-cyan-950 border border-cyan-800/50 flex items-center justify-center shrink-0 mt-0.5">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-xs font-semibold text-slate-200">Role-Based Access Control (RBAC)</h2>
                    <p className="text-[11px] text-slate-400">Custom permission tiers for Executives, Principal Brokers, and Acquisition Specialists.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-md bg-cyan-950 border border-cyan-800/50 flex items-center justify-center shrink-0 mt-0.5">
                    <Database className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-xs font-semibold text-slate-200">Real-Time Firestore &amp; Cloud SQL Sync</h2>
                    <p className="text-[11px] text-slate-400">Continuous bi-directional telemetry synchronizing agent actions and human approvals.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tenant Attribution Footer */}
            <div className="mt-8 pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
              <span>Tenant: <strong className="text-slate-300">CMC Realty Group</strong></span>
              <span>v1.0.0 Enterprise</span>
            </div>
          </div>

          {/* Right Column: Authentication Card with Modes */}
          <div className="lg:col-span-7 p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col justify-between">
            <div>
              {/* Auth Mode Tabs */}
              <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    clearError();
                    setAuthMode('signin');
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center justify-center space-x-1.5 ${
                    authMode === 'signin'
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    clearError();
                    setAuthMode('signup');
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center justify-center space-x-1.5 ${
                    authMode === 'signup'
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Create Account</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    clearError();
                    setAuthMode('demo');
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center justify-center space-x-1.5 ${
                    authMode === 'demo'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-indigo-400 hover:text-indigo-200 hover:bg-slate-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>1-Click Personas</span>
                </button>
              </div>

              {/* Error Banner */}
              {error && (
                <div className="mb-5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-start space-x-2.5 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">Authentication Notice</p>
                    <p className="text-[11px] text-rose-300 mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              {/* MODE 1: SIGN IN */}
              {authMode === 'signin' && (
                <div className="space-y-4">
                  {/* Google 1-Click Sign-in (Optional) */}
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isSubmitting || loading}
                    className="w-full flex items-center justify-center space-x-3 py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs transition shadow-md hover:shadow-lg disabled:opacity-60 cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Continue with Google (Optional Sign-In)</span>
                  </button>
                  <p className="text-[10px] text-slate-500 text-center -mt-2">
                    Google Sign-In is optional. You can also sign in with email, 1-click personas, or skip to guest explore.
                  </p>

                  <div className="relative flex items-center justify-center my-3">
                    <div className="border-t border-slate-800 w-full"></div>
                    <span className="bg-slate-900 px-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                      Or sign in with email
                    </span>
                  </div>

                  <form onSubmit={handleEmailSignIn} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Work Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="executive@cmcrealty.com"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-slate-300">
                          Password
                        </label>
                      </div>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-10 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-300"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting || loading}
                      className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs transition shadow-lg shadow-cyan-600/20 disabled:opacity-60 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <span>Authenticating Session...</span>
                      ) : (
                        <>
                          <span>Sign In to Vortex One</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>

                  <div className="pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={handleGuestExplore}
                      className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 hover:border-cyan-500/50 border border-slate-800 text-slate-300 hover:text-white font-semibold text-xs transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Skip Sign-In / Explore Platform as Guest</span>
                    </button>
                  </div>
                </div>
              )}

              {/* MODE 2: SIGN UP / NEW TENANT */}
              {authMode === 'signup' && (
                <form onSubmit={handleEmailSignUp} className="space-y-3.5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Full Legal Name
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Kristina Madrigal"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Organization / Brokerage
                      </label>
                      <div className="relative">
                        <Building className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={orgName}
                          onChange={(e) => setOrgName(e.target.value)}
                          placeholder="CMC Realty Group"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Business Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="kristina@cmcrealty.com"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Security Role
                      </label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                      >
                        <option value="executive">Operations Executive</option>
                        <option value="admin">Principal Admin</option>
                        <option value="manager">Portfolio Manager</option>
                        <option value="agent">Brokerage Agent</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Password (6+ chars)
                      </label>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-9 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-900/60 text-[11px] text-cyan-300 space-y-1">
                    <p className="font-semibold flex items-center space-x-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Automatic Tenant Provisioning</span>
                    </p>
                    <p className="text-slate-400">
                      Creates isolated Firestore collections &amp; Cloud SQL schema partition for <strong className="text-slate-200">{orgName}</strong>.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || loading}
                    className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs transition shadow-lg shadow-cyan-600/20 disabled:opacity-60 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <span>Provisioning Workspace...</span>
                    ) : (
                      <>
                        <span>Complete Registration &amp; Enter Platform</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* MODE 3: 1-CLICK VERIFICATION PERSONAS */}
              {authMode === 'demo' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-900/60 text-xs text-indigo-200">
                    <p className="font-semibold flex items-center space-x-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      <span>Instant Multi-Tenant Test Authentication</span>
                    </p>
                    <p className="text-[11px] text-indigo-300 mt-1">
                      Click any persona below to authenticate with active session tokens, testing role-based data partitioning between organizations.
                    </p>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {DEMO_USERS.map((persona) => (
                      <div
                        key={persona.id}
                        onClick={() => handleDemoSignIn(persona.id)}
                        className="group p-3 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/60 transition cursor-pointer flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3">
                          <img
                            src={persona.avatar}
                            alt={persona.name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-700 group-hover:border-cyan-400"
                          />
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="font-bold text-xs text-white group-hover:text-cyan-300">{persona.name}</h3>
                              <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                                {persona.role}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">{persona.organization_name}</p>
                            <p className="text-[10px] text-slate-500">{persona.description}</p>
                          </div>
                        </div>

                        <div className="w-7 h-7 rounded-lg bg-slate-900 group-hover:bg-cyan-600 text-slate-400 group-hover:text-white flex items-center justify-center transition">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Help Notice */}
            <div className="mt-6 pt-4 border-t border-slate-800 text-center text-xs text-slate-500">
              Need assistance? Contact support at <a href="mailto:support@cmcrealty.com" className="text-cyan-400 hover:underline">support@cmcrealty.com</a>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Security Assurance Bar */}
      <footer className="relative z-10 w-full border-t border-slate-800/80 bg-slate-950 px-6 py-3 flex flex-wrap items-center justify-between text-xs text-slate-500">
        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>256-bit AES Tenant Encryption</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Multi-Tenant Row-Level Security</span>
          </span>
        </div>
        <div>
          &copy; {new Date().getFullYear()} Vortex One Autonomous Systems • All rights reserved.
        </div>
      </footer>
    </div>
  );
};
