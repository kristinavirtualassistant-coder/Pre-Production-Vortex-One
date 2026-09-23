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
}

interface AuthContextType {
  user: AuthUser | null;
  userProfile: UserProfile | null;
  activeTenant: OrganizationTenant | null;
  availableTenants: OrganizationTenant[];
  loading: boolean;
  error: string | null;
  isGuest: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (params: SignUpParams) => Promise<void>;
  signOut: () => Promise<void>;
  switchOrganization: (orgId: string, orgName: string) => Promise<void>;
  updateUserProfileData: (updates: Partial<UserProfile>) => Promise<void>;
  clearError: () => void;
  getAuthHeaders: () => Record<string, string>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const SESSION_KEY = 'vortex_postgresql_session';

type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserProfile['role'];
  organization_id: string;
  organization_name?: string;
  organization_slug?: string;
  organization_settings?: Record<string, unknown>;
};

function profileFromUser(user: SessionUser): UserProfile {
  const now = new Date().toISOString();
  return {
    uid: user.id,
    email: user.email,
    displayName: user.name,
    role: user.role,
    organization_id: user.organization_id,
    organization_name: user.organization_name || user.organization_id,
    tenant_ids: [user.organization_id],
    createdAt: now,
    lastLoginAt: now,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeTenant, setActiveTenant] = useState<OrganizationTenant | null>(null);
  const [availableTenants, setAvailableTenants] = useState<OrganizationTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const applySession = useCallback((payload: { token: string; user: SessionUser }) => {
    const profile = profileFromUser(payload.user);
    const tenant: OrganizationTenant = {
      id: profile.organization_id,
      name: profile.organization_name,
      slug: payload.user.organization_slug || profile.organization_id.replace(/^org_/, ''),
      settings: payload.user.organization_settings,
    };
    setAccessToken(payload.token);
    setUser({ uid: payload.user.id, email: payload.user.email, displayName: payload.user.name });
    setUserProfile(profile);
    setActiveTenant(tenant);
    setAvailableTenants([tenant]);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      setLoading(false);
      return;
    }
    try {
      const saved = JSON.parse(raw);
      if (!saved?.token || !saved?.user?.id) throw new Error('Invalid session');
      applySession(saved);
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  const signInWithEmail = useCallback(async (email: string, pass: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Sign-in failed');
      applySession(data);
    } catch (err: any) {
      const message = err?.message || 'Sign-in failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  const signUpWithEmail = useCallback(async (params: SignUpParams) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: params.email,
          password: params.password,
          name: params.name,
          organizationName: params.organizationName,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Sign-up failed');
      await signInWithEmail(params.email, params.password);
    } catch (err: any) {
      const message = err?.message || 'Sign-up failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [signInWithEmail]);

  const signOut = useCallback(async () => {
    try {
      if (accessToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
    } finally {
      localStorage.removeItem(SESSION_KEY);
      setAccessToken(null);
      setUser(null);
      setUserProfile(null);
      setActiveTenant(null);
      setAvailableTenants([]);
    }
  }, [accessToken]);

  const switchOrganization = useCallback(async (orgId: string, orgName: string) => {
    if (!userProfile || orgId !== userProfile.organization_id) {
      throw new Error('Organization switching is limited to authenticated PostgreSQL memberships');
    }
    setActiveTenant({ id: orgId, name: orgName, slug: orgId.replace(/^org_/, '') });
  }, [userProfile]);

  const updateUserProfileData = useCallback(async (updates: Partial<UserProfile>) => {
    setUserProfile((current) => current ? { ...current, ...updates } : current);
    setUser((current) => current ? { ...current, displayName: updates.displayName ?? current.displayName } : current);
  }, []);

  const clearError = useCallback(() => setError(null), []);
  const getAuthHeaders = useCallback(() => {
    if (!accessToken || !userProfile) return {};
    return {
      Authorization: `Bearer ${accessToken}`,
      'x-organization-id': userProfile.organization_id,
      'x-user-id': userProfile.uid,
      'x-user-email': userProfile.email,
    };
  }, [accessToken, userProfile]);
  const getAccessToken = useCallback(async () => accessToken, [accessToken]);

  const signInWithGoogle = useCallback(async () => {
    throw new Error('Google sign-in is not available. Use PostgreSQL email/password authentication.');
  }, []);

  const value: AuthContextType = {
    user,
    userProfile,
    activeTenant,
    availableTenants,
    loading,
    error,
    isGuest: false,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    switchOrganization,
    updateUserProfileData,
    clearError,
    getAuthHeaders,
    getAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
