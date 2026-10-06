import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'admin' | 'executive' | 'manager' | 'agent' | 'member';
  organization_id: string;
  organization_name: string;
  tenant_ids: string[];
  createdAt: string;
  lastLoginAt: string;
  emailVerified?: boolean;
  mfaEnabled?: boolean;
}

export interface OrganizationTenant {
  id: string;
  name: string;
  slug: string;
  plan?: string;
  settings?: Record<string, unknown>;
}

export interface AuthUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}

interface SignUpParams {
  email: string;
  password: string;
  name: string;
  organizationName: string;
  inviteToken?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  userProfile: UserProfile | null;
  activeTenant: OrganizationTenant | null;
  availableTenants: OrganizationTenant[];
  loading: boolean;
  error: string | null;
  isGuest: boolean;
  mfaChallengeToken: string | null;
  verificationRequired: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<{ mfaRequired?: boolean }>;
  verifyMfa: (code: string) => Promise<void>;
  signUpWithEmail: (params: SignUpParams) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchOrganization: (orgId: string, orgName: string) => Promise<void>;
  updateUserProfileData: (updates: Partial<UserProfile>) => Promise<void>;
  clearError: () => void;
  getAuthHeaders: () => Record<string, string>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserProfile['role'];
  organization_id: string;
  organization_name?: string;
  organization_slug?: string;
  organization_settings?: Record<string, unknown>;
  email_verified_at?: string;
  mfa_enabled?: boolean;
  created_at?: string;
  last_login_at?: string;
};

function profileFromUser(user: SessionUser): UserProfile {
  return {
    uid: user.id,
    email: user.email,
    displayName: user.name,
    role: user.role,
    organization_id: user.organization_id,
    organization_name: user.organization_name || user.organization_id,
    tenant_ids: [user.organization_id],
    createdAt: user.created_at || new Date().toISOString(),
    lastLoginAt: user.last_login_at || new Date().toISOString(),
    emailVerified: Boolean(user.email_verified_at),
    mfaEnabled: Boolean(user.mfa_enabled),
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeTenant, setActiveTenant] = useState<OrganizationTenant | null>(null);
  const [availableTenants, setAvailableTenants] = useState<OrganizationTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
  const [verificationRequired, setVerificationRequired] = useState(false);

  const applyUser = useCallback((payload: { user: SessionUser }) => {
    const profile = profileFromUser(payload.user);
    const tenant: OrganizationTenant = {
      id: profile.organization_id,
      name: profile.organization_name,
      slug: payload.user.organization_slug || profile.organization_id.replace(/^org_/, ''),
      settings: payload.user.organization_settings,
    };
    setUser({ uid: payload.user.id, email: payload.user.email, displayName: payload.user.name });
    setUserProfile(profile);
    setActiveTenant(tenant);
    setAvailableTenants([tenant]);
    setMfaChallengeToken(null);
    setVerificationRequired(false);
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (active && data?.user?.id) applyUser({ user: data.user });
      })
      .catch(() => undefined)
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applyUser]);

  const signInWithEmail = useCallback(async (email: string, pass: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error: any = new Error(data.error || 'Sign-in failed');
        error.code = data.code;
        throw error;
      }
      if (data.mfaRequired && data.challengeToken) {
        setMfaChallengeToken(data.challengeToken);
        return { mfaRequired: true };
      }
      applyUser(data);
      return { mfaRequired: false };
    } catch (err: any) {
      setError(err?.message || 'Sign-in failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [applyUser]);

  const verifyMfa = useCallback(async (code: string) => {
    if (!mfaChallengeToken) throw new Error('MFA challenge is missing');
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeToken: mfaChallengeToken, code }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'MFA verification failed');
      applyUser(data);
    } catch (err: any) {
      setError(err?.message || 'MFA verification failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [mfaChallengeToken, applyUser]);

  const signUpWithEmail = useCallback(async (params: SignUpParams) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Sign-up failed');
      setVerificationRequired(Boolean(data.verificationRequired));
    } catch (err: any) {
      setError(err?.message || 'Sign-up failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const response = await fetch('/api/auth/password-reset/request', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) throw new Error('Unable to process password recovery request');
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      setUser(null);
      setUserProfile(null);
      setActiveTenant(null);
      setAvailableTenants([]);
      setMfaChallengeToken(null);
      setVerificationRequired(false);
    }
  }, []);

  const switchOrganization = useCallback(async (orgId: string, orgName: string) => {
    if (!userProfile || orgId !== userProfile.organization_id) {
      throw new Error('Organization switching is limited to authenticated memberships');
    }
    setActiveTenant({ id: orgId, name: orgName, slug: orgId.replace(/^org_/, '') });
  }, [userProfile]);

  const updateUserProfileData = useCallback(async (updates: Partial<UserProfile>) => {
    setUserProfile((current) => current ? { ...current, ...updates } : current);
    setUser((current) => current ? { ...current, displayName: updates.displayName ?? current.displayName } : current);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const getAuthHeaders = useCallback(() => {
    if (!userProfile) return {};
    return {
      'x-organization-id': userProfile.organization_id,
      'x-user-id': userProfile.uid,
      'x-user-email': userProfile.email,
    };
  }, [userProfile]);

  const getAccessToken = useCallback(async () => null, []);

  const signInWithGoogle = useCallback(async () => {
    throw new Error('Google sign-in is not available. Use verified PostgreSQL email/password authentication.');
  }, []);

  return (
    <AuthContext.Provider value={{
      user,userProfile,activeTenant,availableTenants,loading,error,isGuest:false,mfaChallengeToken,verificationRequired,
      signInWithGoogle,signInWithEmail,verifyMfa,signUpWithEmail,requestPasswordReset,signOut,switchOrganization,
      updateUserProfileData,clearError,getAuthHeaders,getAccessToken
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
