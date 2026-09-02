import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  onIdTokenChanged,
  User as FirebaseUser,
  updateProfile,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocFromServer,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firestore (using configured databaseId if available)
export const db = (firebaseConfig as any).firestoreDatabaseId && (firebaseConfig as any).firestoreDatabaseId !== '(default)'
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);

// Test Firestore Connection on Boot as per guidelines
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'system_health', 'connection_probe'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Firestore client is offline or starting up.');
    }
    return false;
  }
}

// User Profile interface for Firestore multi-tenant identity
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'admin' | 'executive' | 'manager' | 'agent';
  organization_id: string;
  organization_name: string;
  tenant_ids: string[];
  createdAt?: any;
  lastLoginAt?: any;
}

export interface OrganizationTenant {
  id: string;
  name: string;
  slug: string;
  created_by?: string;
  plan?: string;
  member_uids?: string[];
  settings?: {
    timezone?: string;
    targetMarket?: string;
  };
}

// Predefined Demo Personas for 1-Click Verification / Evaluation
export const DEMO_USERS: Array<{
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'executive' | 'manager' | 'agent';
  organization_id: string;
  organization_name: string;
  avatar: string;
  description: string;
}> = [
  {
    id: 'demo_exec_kristina',
    name: 'Kristina Madrigal',
    email: 'kristinamadrigal.17@gmail.com',
    role: 'executive',
    organization_id: 'org_cmc_realty',
    organization_name: 'CMC Realty & Property Management',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    description: 'Executive Director • Orange County Portfolio Strategy',
  },
  {
    id: 'demo_broker_marcus',
    name: 'Marcus Vance',
    email: 'marcus.vance@cmcrealty.com',
    role: 'admin',
    organization_id: 'org_cmc_realty',
    organization_name: 'CMC Realty & Property Management',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
    description: 'Principal Broker • Commercial Acquisitions & Owner Intelligence',
  },
  {
    id: 'demo_manager_sarah',
    name: 'Sarah Lin',
    email: 'sarah.lin@cmcrealty.com',
    role: 'manager',
    organization_id: 'org_cmc_realty',
    organization_name: 'CMC Realty & Property Management',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    description: 'Asset Operations Manager • Dialer & Lead Pipelines',
  },
  {
    id: 'demo_pacific_horizon',
    name: 'David Sterling',
    email: 'david@sterlingwest.com',
    role: 'executive',
    organization_id: 'org_sterling_holdings',
    organization_name: 'Sterling West Holdings (Separate Tenant)',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    description: 'Managing Member • Multi-Tenant Isolated Data Sandbox',
  },
];

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  firebaseSignOut,
  onAuthStateChanged,
  onIdTokenChanged,
  updateProfile,
  GoogleAuthProvider,
};
export type { FirebaseUser };
