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
  organizationName?: string;
  role?: 'admin' | 'executive' | 'manager' | 'agent';
}

interface AuthContextType {
  user: AuthUser | null;
  userProfile: UserProfile | null;
  activeTenant: OrganizationTenant;
  availableTenants: OrganizationTenant[];
  loading: boolean;
  error: string | null;
  isGuest: boolean;
  continueAsGuest: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (params: SignUpParams) => Promise<void>;
  signInAsDemoPersona: (personaId: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchOrganization: (orgId: string, orgName: string) => Promise<void>;
  updateUserProfileData: (updates: Partial<UserProfile>) => Promise<void>;
  clearError: () => void;
  getAuthHeaders: () => Record<string, string>;
  getAccessToken: () => Promise<string | null>;
}

const DEFAULT_TENANT: OrganizationTenant = {
  id: 'org_cmc_realty',
  name: 'CMC Realty',
  slug: 'cmc-realty',
  plan: 'Enterprise',
  settings: { timezone: 'America/Los_Angeles', targetMarket: 'Orange County, CA' },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const SESSION_KEY = 'vortex_postgresql_session';

function profileFromUser(user: { id: string; email: string; name: string; role: UserProfile['role']; organization_id: string }): UserProfile {
  const now = new Date().toISOString();
  return {
    uid: user.id,
    email: user.email,
    displayName: user.name,
    role: user.role,
    organization_id: user.organization_id,
    organization_name: user.organization_id === DEFAULT_TENANT.id ? DEFAULT_TENANT.name : user.organization_id,
    tenant_ids: [user.organization_id],
    createdAt: now,
    lastLoginAt: now,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeTenant, setActiveTenant] = useState<OrganizationTenant>(DEFAULT_TENANT);
  const [availableTenants, setAvailableTenants] = useState<OrganizationTenant[]>([DEFAULT_TENANT]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  const applySession = useCallback((payload: { token: string; user: { id: string; email: string; name: string; role: UserProfile['role']; organization_id: string } }) => {
    const profile = profileFromUser(payload.user);
    setAccessToken(payload.token);
    setUser({ uid: payload.user.id, email: payload.user.email, displayName: payload.user.name });
    setUserProfile(profile);
    const tenant: OrganizationTenant = {
      id: profile.organization_id,
      name: profile.organization_name,
      slug: profile.organization_id.replace(/^org_/, ''),
      plan: 'Enterprise',
    };
    setActiveTenant(tenant);
    setAvailableTenants([tenant]);
    setIsGuest(false);
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      setLoading(false);
      return;
    }

    try {
      const saved = JSON.parse(raw);
      if (!saved?.token || !saved?.user?.id) throw new Error('Invalid session');
      applySession(saved);
    } catch {
      localStorage.removeItem(SESSION_KEY);
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
      const organizationId = params.organizationName
        ? `org_${params.organizationName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
        : DEFAULT_TENANT.id;
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: params.email,
          password: params.password,
          name: params.name,
          organizationId,
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
      setActiveTenant(DEFAULT_TENANT);
      setAvailableTenants([DEFAULT_TENANT]);
      setIsGuest(false);
    }
  }, [accessToken]);

  const continueAsGuest = useCallback(() => {
    setError(null);
    setIsGuest(true);
    setUser(null);
    setUserProfile(null);
    setAccessToken(null);
  }, []);

  const switchOrganization = useCallback(async (orgId: string, orgName: string) => {
    if (!userProfile || orgId !== userProfile.organization_id) {
      throw new Error('Organization switching is limited to authenticated PostgreSQL memberships');
    }
    setActiveTenant({ id: orgId, name: orgName, slug: orgId.replace(/^org_/, ''), plan: 'Enterprise' });
  }, [userProfile]);

  const updateUserProfileData = useCallback(async (updates: Partial<UserProfile>) => {
    setUserProfile((current) => current ? { ...current, ...updates } : current);
    setUser((current) => current ? {
      ...current,
      displayName: updates.displayName ?? current.displayName,
    } : current);
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

  const signInAsDemoPersona = useCallback(async (_personaId: string) => {
    throw new Error('Demo personas are disabled. Use a real PostgreSQL account.');
  }, []);

  const value: AuthContextType = {
    user,
    userProfile,
    activeTenant,
    availableTenants,
    loading,
    error,
    isGuest,
    continueAsGuest,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signInAsDemoPersona,
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
