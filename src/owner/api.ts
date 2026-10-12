/**
 * Owner Portal API client.
 *  - Authentication is the HttpOnly session cookie only. Nothing is read from or written to localStorage/sessionStorage
 *    and no token is ever held in JavaScript.
 *  - State-changing calls send X-Vortex-Owner (CSRF defence; the server rejects them without it).
 *  - The UI is never the security boundary: every call is authorized again by the server.
 */
export class OwnerApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); this.name = 'OwnerApiError'; }
}

type Listener = () => void;
const sessionExpiredListeners = new Set<Listener>();
/** Called when an authenticated call comes back 401 (expired / revoked session). */
export function onSessionExpired(listener: Listener): () => void {
  sessionExpiredListeners.add(listener);
  return () => { sessionExpiredListeners.delete(listener); };
}

async function request<T>(method: string, path: string, body?: unknown, opts: { expectAuth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['X-Vortex-Owner'] = '1';
  let response: Response;
  try {
    response = await fetch(path, { method, credentials: 'include', cache: 'no-store', headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new OwnerApiError(0, 'Network error. Check your connection and try again.');
  }
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && opts.expectAuth !== false) sessionExpiredListeners.forEach((l) => l());
  if (!response.ok) throw new OwnerApiError(response.status, (data as any)?.error || `Request failed (${response.status})`, (data as any)?.code);
  return data as T;
}

export const ownerGet = <T>(path: string) => request<T>('GET', path);
/** Session probe: a 401 here means "not signed in", NOT "session expired", so it never triggers the expiry flow. */
export const ownerProbe = <T>(path: string) => request<T>('GET', path, undefined, { expectAuth: false });
export const ownerPost = <T>(path: string, body: unknown = {}) => request<T>('POST', path, body);
export const ownerPut = <T>(path: string, body: unknown) => request<T>('PUT', path, body);

/** Shared customer authentication endpoints (no separate owner login system exists). */
export const authPost = <T>(path: string, body: unknown) => request<T>('POST', path, body, { expectAuth: false });

export interface OwnerSession {
  owner: { userId: string; email: string; role: 'platform_owner'; mfaEnabled: boolean; mfaVerified: boolean };
  supportSession: null | { id: string; organization_id: string; organization_name: string; reason: string; started_at: string; expires_at: string };
}

export function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}
