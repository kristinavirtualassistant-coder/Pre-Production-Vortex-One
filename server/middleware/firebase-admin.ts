import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

export function ensureFirebaseAdminApp(): App {
  const existingApp = getApps()[0];
  if (existingApp) {
    return existingApp;
  }

  return initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

export const adminAuth = getAuth(ensureFirebaseAdminApp());
