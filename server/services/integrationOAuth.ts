import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { Pool } from 'pg';

export type OAuthProvider = 'google-workspace' | 'microsoft-365';

type ProviderConfig = {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
};

const CALLBACK_PATHS: Record<OAuthProvider, string> = {
  'google-workspace': '/api/integrations/oauth/callback/google-workspace',
  'microsoft-365': '/api/integrations/oauth/callback/microsoft-365',
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function getProviderConfig(provider: OAuthProvider): ProviderConfig {
  if (provider === 'google-workspace') {
    return {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      clientId: requiredEnv('GOOGLE_INTEGRATION_CLIENT_ID'),
      clientSecret: requiredEnv('GOOGLE_INTEGRATION_CLIENT_SECRET'),
      scopes: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive.readonly'],
    };
  }
  return {
    authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    clientId: requiredEnv('MICROSOFT_INTEGRATION_CLIENT_ID'),
    clientSecret: requiredEnv('MICROSOFT_INTEGRATION_CLIENT_SECRET'),
    scopes: ['openid', 'profile', 'email', 'offline_access', 'User.Read'],
  };
}

function encryptionKey(): Buffer {
  const raw = requiredEnv('INTEGRATION_ENCRYPTION_KEY');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('INTEGRATION_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  return key;
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString('base64url')).join('.');
}

export function decryptSecret(value: string): string {
  const [ivRaw, tagRaw, ciphertextRaw] = value.split('.');
  if (!ivRaw || !tagRaw || !ciphertextRaw) throw new Error('Invalid encrypted integration secret');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, 'base64url')), decipher.final()]).toString('utf8');
}

function baseUrl(): string {
  return (process.env.APP_URL || 'http://localhost:8080').replace(/\/$/, '');
}

export function callbackUrl(provider: OAuthProvider): string {
  return `${baseUrl()}${CALLBACK_PATHS[provider]}`;
}

export async function createOAuthStart(pool: Pool, args: {
  provider: OAuthProvider;
  userId: string;
  organizationId: string;
}): Promise<string> {
  const config = getProviderConfig(args.provider);
  const state = randomBytes(32).toString('base64url');
  const codeVerifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(codeVerifier).digest('base64url');
  const redirectUri = callbackUrl(args.provider);

  await pool.query(
    `INSERT INTO integration_oauth_states
      (state_hash, provider, user_id, organization_id, code_verifier, redirect_uri, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP + INTERVAL '10 minutes')`,
    [createHash('sha256').update(state).digest('hex'), args.provider, args.userId, args.organizationId, encryptSecret(codeVerifier), redirectUri],
  );

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });
  if (args.provider === 'microsoft-365') {
    params.delete('access_type');
    params.delete('prompt');
  }
  return `${config.authorizationEndpoint}?${params.toString()}`;
}

export async function completeOAuthCallback(pool: Pool, provider: OAuthProvider, state: string, code: string) {
  const stateHash = createHash('sha256').update(state).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const stateResult = await client.query(
      `SELECT * FROM integration_oauth_states
       WHERE state_hash = $1 AND provider = $2 AND expires_at > CURRENT_TIMESTAMP
       FOR UPDATE`,
      [stateHash, provider],
    );
    const oauthState = stateResult.rows[0];
    if (!oauthState) throw new Error('OAuth state is invalid or expired');

    await client.query('DELETE FROM integration_oauth_states WHERE state_hash = $1', [stateHash]);
    const config = getProviderConfig(provider);
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: oauthState.redirect_uri,
      grant_type: 'authorization_code',
      code_verifier: decryptSecret(oauthState.code_verifier),
    });
    const response = await fetch(config.tokenEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const token = await response.json() as Record<string, any>;
    if (!response.ok || !token.access_token) throw new Error(token.error_description || token.error || 'OAuth token exchange failed');

    const accessToken = encryptSecret(String(token.access_token));
    const refreshToken = token.refresh_token ? encryptSecret(String(token.refresh_token)) : null;
    const expiresAt = token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : null;

    let externalAccountId = '';
    let accountEmail = '';
    if (provider === 'google-workspace') {
      const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` } });
      const profile = await profileResponse.json() as Record<string, any>;
      externalAccountId = String(profile.sub || profile.email || 'google');
      accountEmail = String(profile.email || '');
    } else {
      const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', { headers: { Authorization: `Bearer ${token.access_token}` } });
      const profile = await profileResponse.json() as Record<string, any>;
      externalAccountId = String(profile.id || profile.userPrincipalName || 'microsoft');
      accountEmail = String(profile.mail || profile.userPrincipalName || '');
    }

    await client.query(
      `INSERT INTO integration_connections
        (id, organization_id, user_id, provider, external_account_id, account_email, access_token, refresh_token, token_expires_at, scopes, status, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'connected',$11)
       ON CONFLICT (organization_id, user_id, provider)
       DO UPDATE SET external_account_id=EXCLUDED.external_account_id, account_email=EXCLUDED.account_email,
         access_token=EXCLUDED.access_token, refresh_token=COALESCE(EXCLUDED.refresh_token, integration_connections.refresh_token),
         token_expires_at=EXCLUDED.token_expires_at, scopes=EXCLUDED.scopes, status='connected', metadata=EXCLUDED.metadata, updated_at=CURRENT_TIMESTAMP`,
      [`int_${randomBytes(16).toString('hex')}`, oauthState.organization_id, oauthState.user_id, provider, externalAccountId, accountEmail, accessToken, refreshToken, expiresAt, config.scopes, JSON.stringify({ provider })],
    );
    await client.query('COMMIT');
    return { organizationId: oauthState.organization_id, userId: oauthState.user_id, accountEmail };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
