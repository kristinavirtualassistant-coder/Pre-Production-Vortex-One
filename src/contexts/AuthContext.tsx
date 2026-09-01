import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  testFirestoreConnection,
  UserProfile,
  OrganizationTenant,
  DEMO_USERS,
  FirebaseUser,
  GoogleAuthProvider,
} from '../lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

interface SignUpParams {
  email: string;
  password: string;
  name: string;
  organizationName?: string;
  role?: 'admin' | 'executive' | 'manager' | 'agent';
}

interface AuthContextType {
  user: FirebaseUser | null;
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
  name: 'CMC Realty & Property Management',
  slug: 'cmc-realty',
  plan: 'Enterprise',
  settings: {
    timezone: 'America/Los_Angeles',
    targetMarket: 'Orange County, CA',
  },
};

const SECONDARY_TENANT: OrganizationTenant = {
  id: 'org_sterling_holdings',
  name: 'Sterling West Holdings (Isolated Tenant)',
  slug: 'sterling-west',
  plan: 'Professional',
  settings: {
    timezone: 'America/Los_Angeles',
    targetMarket: 'Los Angeles & Beverly Hills, CA',
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeTenant, setActiveTenant] = useState<OrganizationTenant>(DEFAULT_TENANT);
  const [availableTenants, setAvailableTenants] = useState<OrganizationTenant[]>([
    DEFAULT_TENANT,
    SECONDARY_TENANT,
  ]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Sync / Fetch user profile from Firestore or Local Cache
  const fetchOrCreateUserProfile = useCallback(
    async (fbUser: FirebaseUser, fallbackRole: 'admin' | 'executive' | 'manager' | 'agent' = 'executive', customOrgName?: string): Promise<UserProfile> => {
      try {
        const userRef = doc(db, 'users', fbUser.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfile;
          const updatedProfile: UserProfile = {
            ...data,
            email: fbUser.email || data.email,
            displayName: fbUser.displayName || data.displayName || 'Vortex User',
            photoURL: fbUser.photoURL || data.photoURL,
            lastLoginAt: new Date().toISOString(),
          };

          try {
            await updateDoc(userRef, {
              lastLoginAt: serverTimestamp(),
            });
          } catch (e) {
            // Ignore background timestamp update error
          }

          return updatedProfile;
        } else {
          // Initialize fresh profile
          const orgId = customOrgName ? `org_${customOrgName.toLowerCase().replace(/[^a-z0-9]/g, '_')}` : DEFAULT_TENANT.id;
          const orgName = customOrgName || DEFAULT_TENANT.name;

          const newProfile: UserProfile = {
            uid: fbUser.uid,
            email: fbUser.email || '',
            displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Vortex Executive',
            photoURL: fbUser.photoURL || undefined,
            role: fallbackRole,
            organization_id: orgId,
            organization_name: orgName,
            tenant_ids: [orgId, DEFAULT_TENANT.id],
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
          };

          try {
            await setDoc(userRef, {
              ...newProfile,
              createdAt: serverTimestamp(),
              lastLoginAt: serverTimestamp(),
            });

            // Also ensure org doc exists
            const orgRef = doc(db, 'organizations', orgId);
            await setDoc(
              orgRef,
              {
                id: orgId,
                name: orgName,
                created_by: fbUser.uid,
                plan: 'Enterprise',
                createdAt: serverTimestamp(),
              },
              { merge: true }
            );
          } catch (writeErr) {
            console.warn('[Firestore] Profile write sync warning:', writeErr);
          }

          return newProfile;
        }
      } catch (err: any) {
        console.warn('[Firestore] Error fetching user profile, using fallback:', err);
        const fallbackProfile: UserProfile = {
          uid: fbUser.uid,
          email: fbUser.email || '',
          displayName: fbUser.displayName || 'Vortex User',
          photoURL: fbUser.photoURL || undefined,
          role: fallbackRole,
          organization_id: DEFAULT_TENANT.id,
          organization_name: DEFAULT_TENANT.name,
          tenant_ids: [DEFAULT_TENANT.id],
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };
        return fallbackProfile;
      }
    },
    []
  );

  // Auth state listener
  useEffect(() => {
    // Probe Firestore connection
    testFirestoreConnection();

    // Check for persisted demo session first
    const savedDemoUser = localStorage.getItem('vortex_demo_session');
    if (savedDemoUser) {
      try {
        const parsed = JSON.parse(savedDemoUser);
        const persona = DEMO_USERS.find((u) => u.id === parsed.id) || parsed;
        const profile: UserProfile = {
          uid: persona.id,
          email: persona.email,
          displayName: persona.name,
          photoURL: persona.avatar,
          role: persona.role,
          organization_id: persona.organization_id,
          organization_name: persona.organization_name,
          tenant_ids: [persona.organization_id, DEFAULT_TENANT.id, SECONDARY_TENANT.id],
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };
        setUserProfile(profile);
        setActiveTenant({
          id: profile.organization_id,
          name: profile.organization_name,
          slug: profile.organization_id.replace('org_', ''),
          plan: 'Enterprise',
        });
        setLoading(false);
        return;
      } catch (e) {
        localStorage.removeItem('vortex_demo_session');
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setUser(fbUser);
        const profile = await fetchOrCreateUserProfile(fbUser);
        setUserProfile(profile);
        setActiveTenant({
          id: profile.organization_id,
          name: profile.organization_name,
          slug: profile.organization_id.replace('org_', ''),
          plan: 'Enterprise',
        });
      } else {
        // Only clear if no demo session active
        if (!localStorage.getItem('vortex_demo_session')) {
          setUser(null);
          setUserProfile(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchOrCreateUserProfile]);

  // Sign In with Google
  const signInWithGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      localStorage.removeItem('vortex_demo_session');
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
      }

      const profile = await fetchOrCreateUserProfile(result.user, 'executive');
      setUserProfile(profile);
      setActiveTenant({
        id: profile.organization_id,
        name: profile.organization_name,
        slug: profile.organization_id.replace('org_', ''),
        plan: 'Enterprise',
      });
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setError(err.message || 'Google sign-in failed. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Sign In with Email & Password
  const signInWithEmail = async (email: string, pass: string) => {
    setError(null);
    setLoading(true);
    try {
      localStorage.removeItem('vortex_demo_session');
      const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
      setUser(result.user);
      const profile = await fetchOrCreateUserProfile(result.user);
      setUserProfile(profile);
      setActiveTenant({
        id: profile.organization_id,
        name: profile.organization_name,
        slug: profile.organization_id.replace('org_', ''),
        plan: 'Enterprise',
      });
    } catch (err: any) {
      console.error('Email sign-in error:', err);
      let msg = 'Authentication failed. Please verify your credentials.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        msg = 'No user account found matching this email and password.';
      } else if (err.code === 'auth/wrong-password') {
        msg = 'Incorrect password entered.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please provide a valid email address.';
      }
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Sign Up with Email & Password
  const signUpWithEmail = async (params: SignUpParams) => {
    setError(null);
    setLoading(true);
    try {
      localStorage.removeItem('vortex_demo_session');
      const result = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
      
      // Update display name on auth user
      if (params.name) {
        await updateProfile(result.user, { displayName: params.name });
      }

      setUser(result.user);
      const profile = await fetchOrCreateUserProfile(
        result.user,
        params.role || 'executive',
        params.organizationName
      );
      setUserProfile(profile);
      setActiveTenant({
        id: profile.organization_id,
        name: profile.organization_name,
        slug: profile.organization_id.replace('org_', ''),
        plan: 'Enterprise',
      });
    } catch (err: any) {
      console.error('Sign up error:', err);
      let msg = err.message || 'Registration failed. Please try again.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email address already exists. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password must be at least 6 characters long.';
      }
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Sign In as Demo Persona for Quick Testing / Verification
  const signInAsDemoPersona = async (personaId: string) => {
    setError(null);
    setLoading(true);
    try {
      const persona逗 = DEMO_USERS.find((u) => u.id === personaId) || DEMO_USERS[0];
      const persona = persona逗;
      
      // Try to sign in with matching test credentials, or set verified demo profile
      localStorage.setItem('vortex_demo_session', JSON.stringify(persona));

      const profile: UserProfile = {
        uid: persona.id,
        email: persona.email,
        displayName: persona.name,
        photoURL: persona.avatar,
        role: persona.role,
        organization_id: persona.organization_id,
        organization_name: persona.organization_name,
        tenant_ids: [persona.organization_id, DEFAULT_TENANT.id, SECONDARY_TENANT.id],
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };

      setUserProfile(profile);
      setActiveTenant({
        id: profile.organization_id,
        name: profile.organization_name,
        slug: profile.organization_id.replace('org_', ''),
        plan: 'Enterprise',
      });

      // Try background Firestore sync for audit trail
      try {
        const userRef拼 = doc(db, 'users', profile.uid);
        await setDoc(userRef拼, profile, { merge: true });
      } catch (e) {
        // Ignore background offline error
      }
    } catch (err: any) {
      console.error('Demo sign-in error:', err);
      setError('Failed to initialize demo persona session.');
    } finally {
      setLoading(false);
    }
  };

  // Continue as Guest (Optional Sign-In)
  const continueAsGuest = useCallback(() => {
    setError(null);
    const guestUser = {
      id: `guest_${Date.now()}`,
      email: 'guest@cmcrealty.com',
      name: 'Guest Explorer',
      role: 'executive' as const,
      organization_id: DEFAULT_TENANT.id,
      organization_name: DEFAULT_TENANT.name,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    };
    localStorage.setItem('vortex_demo_session', JSON.stringify(guestUser));
    const profile: UserProfile = {
      uid: guestUser.id,
      email: guestUser.email,
      displayName: guestUser.name,
      photoURL: guestUser.avatar,
      role: guestUser.role,
      organization_id: guestUser.organization_id,
      organization_name: guestUser.organization_name,
      tenant_ids: [guestUser.organization_id, DEFAULT_TENANT.id, SECONDARY_TENANT.id],
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    setUserProfile(profile);
    setActiveTenant(DEFAULT_TENANT);
  }, []);

  const isGuest = Boolean(!user && (userProfile?.uid?.startsWith('guest_') || !userProfile));

  // Sign Out
  const signOut = async () => {
    setError(null);
    try {
      localStorage.removeItem('vortex_demo_session');
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
    } catch (err: any) {
      console.error('Sign-out error:', err);
    }
  };

  // Switch Organization / Tenant
  const switchOrganization = async (orgId: string, orgName: string) => {
    if (!userProfile) return;
    const updated: UserProfile = {
      ...userProfile,
      organization_id: orgId,
      organization_name: orgName,
    };
    setUserProfile(updated);
    setActiveTenant({
      id: orgId,
      name: orgName,
      slug: orgId.replace('org_', ''),
      plan: 'Enterprise',
    });

    if (user?.uid) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          organization_id: orgId,
          organization_name: orgName,
        });
      } catch (e) {
        console.warn('Tenant switch Firestore sync error:', e);
      }
    }
  };

  // Update Profile
  const updateUserProfileData = async (updates: Partial<UserProfile>) => {
    if (!userProfile) return;
    const updated = { ...userProfile, ...updates };
    setUserProfile(updated);

    if (user?.uid) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, updates);
      } catch (e) {
        console.warn('Profile update Firestore sync error:', e);
      }
    }
  };

  const clearError = () => setError(null);

  // Return standard auth headers for multi-tenant backend API requests
  const getAuthHeaders = (): Record<string, string> => {
    return {
      'x-organization-id': activeTenant.id,
      'x-organization-name': activeTenant.name,
      'x-user-id': userProfile?.uid || 'anonymous',
      'x-user-email': userProfile?.email || '',
      'x-user-role': userProfile?.role || 'executive',
      'Authorization': accessToken ? `Bearer ${accessToken}` : '',
    };
  };

  const getAccessToken = async (): Promise<string | null> => {
    return accessToken;
  };

  return (
    <AuthContext.Provider
      value={{
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
