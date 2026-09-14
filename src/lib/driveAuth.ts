import { useEffect } from 'react';

export interface DriveOAuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
}

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  callback: (response: GoogleTokenResponse) => void;
  requestAccessToken: (options?: { prompt?: string }) => void;
}

interface GoogleIdentityServices {
  accounts: {
    oauth2: {
      initTokenClient: (options: {
        client_id: string;
        scope: string;
        callback: (response: GoogleTokenResponse) => void;
      }) => GoogleTokenClient;
      revoke: (token: string, callback?: () => void) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

export const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
].join(' ');

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const GIS_SCRIPT_ID = 'google-identity-services-script';
let tokenClient: GoogleTokenClient | null = null;
let activeAccessToken: string | null = null;
let activeUser: DriveOAuthUser | null = null;
let gisLoadPromise: Promise<void> | null = null;

function loadGoogleIdentityServices(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(GIS_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google Identity Services failed to load')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = GIS_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Identity Services failed to load'));
    document.head.appendChild(script);
  }).catch((error) => {
    gisLoadPromise = null;
    throw error;
  });

  return gisLoadPromise;
}

async function ensureTokenClient(): Promise<GoogleTokenClient> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('VITE_GOOGLE_CLIENT_ID is required for Google Drive/Sheets access.');
  }

  await loadGoogleIdentityServices();
  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services is unavailable.');
  }

  if (!tokenClient) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: () => undefined,
    });
  }

  return tokenClient;
}

async function fetchGoogleUser(accessToken: string): Promise<DriveOAuthUser> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Google user profile request failed (${response.status}).`);
  }

  const profile = await response.json() as {
    sub?: string;
    email?: string;
    name?: string;
    picture?: string;
  };

  if (!profile.sub || !profile.email) {
    throw new Error('Google did not return a usable user profile.');
  }

  return {
    uid: profile.sub,
    email: profile.email,
    displayName: profile.name || profile.email,
    photoURL: profile.picture || null,
  };
}

export async function googleSignIn(): Promise<{
  user: DriveOAuthUser;
  accessToken: string;
}> {
  const client = await ensureTokenClient();

  const accessToken = await new Promise<string>((resolve, reject) => {
    client.callback = (response) => {
      if (response.error || !response.access_token) {
        reject(new Error(response.error_description || response.error || 'Google authorization failed.'));
        return;
      }
      resolve(response.access_token);
    };
    client.requestAccessToken({ prompt: activeAccessToken ? '' : 'consent' });
  });

  const user = await fetchGoogleUser(accessToken);
  activeAccessToken = accessToken;
  activeUser = user;
  return { user, accessToken };
}

export function initAuth(
  onAuthStateChanged: (user: DriveOAuthUser, accessToken: string) => void,
  onAuthFailure: () => void,
): () => void {
  if (activeUser && activeAccessToken) {
    onAuthStateChanged(activeUser, activeAccessToken);
  } else {
    onAuthFailure();
  }

  return () => undefined;
}

export async function logout(): Promise<void> {
  if (activeAccessToken && window.google?.accounts?.oauth2) {
    await new Promise<void>((resolve) => {
      window.google?.accounts.oauth2.revoke(activeAccessToken!, () => resolve());
    });
  }
  activeAccessToken = null;
  activeUser = null;
}

export function getAccessToken(): string | null {
  return activeAccessToken;
}

export function getCachedToken(): string | null {
  return activeAccessToken;
}

export function getOAuthUser(): DriveOAuthUser | null {
  return activeUser;
}

export async function signInWithGoogle(): Promise<{ user: DriveOAuthUser; accessToken: string }> {
  return googleSignIn();
}

export function setAccessTokenInMemory(token: string | null): void {
  activeAccessToken = token;
}

export function useDriveAuth(onReady: () => void): void {
  useEffect(() => {
    if (activeAccessToken) onReady();
  }, [onReady]);
}
