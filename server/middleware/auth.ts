import { randomUUID } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { getPgPool } from '../db/db';
import { getOrganizationBilling, planLimits } from '../services/billingService';
import { ensurePostgreSQLAuthSchema } from '../db/postgresqlAuthSchema';
import { hashPassword, hashSessionToken, verifyPassword } from '../services/postgresqlAuth';
import { appUrl, clearSessionCookie, createOneTimeToken, createTotpSecret, createTotpUri, decryptMfaSecret, encryptMfaSecret, generateBackupCodes, getSessionToken, hashBackupCodes, hashOneTimeToken, issueSession, sendSecurityEmail, verifyTotp } from '../services/accountSecurity';
import { createCheckoutSession, createPortalSession } from '../services/billingService';
import { beginTenantContext, enterTenantContext, finishTenantContext } from '../db/tenantContext';

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email: string;
    name: string;
    role: string;
  };
  dbUser?: {
    id: string;
    organization_id: string;
    email: string;
    name: string;
    role: string;
  };
}

export class AuthorizationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 403) {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = statusCode;
  }
}

/**
 * Identify API-relative health, callback, webhook, and tracking paths that bypass session auth.
 */
export function shouldBypassApiAuth(path: string): boolean {
  return path === '/health' || path === '/ready' || path === '/billing/webhook' || path.startsWith('/telephony/webhook/') || path.startsWith('/integrations/oauth/callback/') || path.startsWith('/communications/webhooks/') || path.startsWith('/communications/tracking/');
}

/**
 * Identity headers that older clients sent. The authenticated PostgreSQL user (session -> users ->
 * organizations) is the ONLY source of user id, email, organization and role, so these are deleted before any
 * handler can read them. `x-organization-id` is deliberately not listed: it is validated for consistency in
 * canonicalizeOrganizationContext and then overwritten with the authenticated organization.
 */
export const CLIENT_IDENTITY_HEADERS = ['x-user-id', 'x-user-email', 'x-user-role', 'x-user-name', 'x-uid'] as const;

export function stripClientIdentityHeaders(req: Request, _res: Response, next: NextFunction) {
  for (const header of CLIENT_IDENTITY_HEADERS) delete req.headers[header];
  next();
}

export function isLocalDevelopmentAuthEnabled(): boolean {
  return false;
}

export function resolveAuthenticatedOrganizationId(
  dbUser: AuthRequest['dbUser'],
  requestedOrganizationId?: string,
): string {
  if (!dbUser?.organization_id) {
    throw new AuthorizationError('Forbidden: No organization is associated with the authenticated user');
  }
  if (requestedOrganizationId && requestedOrganizationId !== dbUser.organization_id) {
    throw new AuthorizationError('Forbidden: Organization does not match authenticated user');
  }
  return dbUser.organization_id;
}

export function canonicalizeOrganizationContext(req: AuthRequest): string {
  const organizationId = resolveAuthenticatedOrganizationId(req.dbUser);
  const queryOrganizationId = req.query.organizationId;
  const body = req.body && typeof req.body === 'object' ? req.body : undefined;
  const requestedValues = [
    queryOrganizationId,
    body?.organizationId,
    body?.organization_id,
    req.headers['x-organization-id'],
  ].flatMap((value) => Array.isArray(value) ? value : [value]).filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );

  if (requestedValues.some((value) => value !== organizationId)) {
    throw new AuthorizationError('Forbidden: Organization does not match authenticated user');
  }

  req.headers['x-organization-id'] = organizationId;
  if (body) {
    body.organizationId = organizationId;
    body.organization_id = organizationId;
  }
  return organizationId;
}

async function handleLogin(req: AuthRequest, res: Response, pool: NonNullable<ReturnType<typeof getPgPool>>) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const result = await pool.query(
    `SELECT u.id, u.organization_id, u.email, u.name, u.role, u.password_hash, u.disabled_at, u.email_verified_at, u.mfa_enabled,
            o.name AS organization_name,o.slug AS organization_slug,o.settings AS organization_settings
     FROM users u JOIN organizations o ON o.id=u.organization_id
     WHERE lower(u.email)=$1 LIMIT 1`, [email]);
  const user = result.rows[0];
  if (!user || user.disabled_at || !user.password_hash || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (!user.email_verified_at) return res.status(403).json({ error: 'Email address must be verified before signing in', code: 'EMAIL_NOT_VERIFIED' });
  if (user.mfa_enabled) {
    const challengeToken = createOneTimeToken();
    await pool.query(
      `INSERT INTO auth_mfa_challenges (id,user_id,challenge_hash,expires_at)
       VALUES ($1,$2,$3,CURRENT_TIMESTAMP + INTERVAL '10 minutes')`,
      [`mfa_${randomUUID()}`,user.id,hashOneTimeToken(challengeToken)]);
    return res.json({ mfaRequired: true, challengeToken });
  }
  const token = await issueSession(pool,user.id,req,res);
  await pool.query('UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=$1',[user.id]);
  return res.json({ token, user: {
    id:user.id,organization_id:user.organization_id,organization_name:user.organization_name,
    organization_slug:user.organization_slug,organization_settings:user.organization_settings,
    email:user.email,name:user.name,role:user.role
  }});
}

async function handleSignup(req: AuthRequest, res: Response, pool: NonNullable<ReturnType<typeof getPgPool>>) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const organizationName = typeof req.body?.organizationName === 'string' ? req.body.organizationName.trim() : '';
  const inviteToken = typeof req.body?.inviteToken === 'string' ? req.body.inviteToken.trim() : '';
  if (!email || !password || !name || (!organizationName && !inviteToken)) return res.status(400).json({ error: 'Email, password, name, and organization are required' });
  if (password.length < 12) return res.status(400).json({ error: 'Password must be at least 12 characters' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'A valid email is required' });
  if (!inviteToken && (organizationName.length < 2 || organizationName.length > 255)) return res.status(400).json({ error: 'Organization name must be between 2 and 255 characters' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existingEmail = await client.query('SELECT id FROM users WHERE lower(email)=lower($1) LIMIT 1',[email]);
    if (existingEmail.rowCount) { await client.query('ROLLBACK'); return res.status(409).json({ error:'An account with this email already exists' }); }

    let organizationId: string;
    let assignedRole = 'admin';
    if (inviteToken) {
      const invite = await client.query(
        `SELECT id,organization_id,email,role,expires_at,accepted_at FROM organization_invites
         WHERE token_hash=$1 AND accepted_at IS NULL AND expires_at>CURRENT_TIMESTAMP
         LIMIT 1 FOR UPDATE`, [hashSessionToken(inviteToken)]);
      const row = invite.rows[0];
      if (!row || row.email.toLowerCase() !== email) { await client.query('ROLLBACK'); return res.status(400).json({ error:'This invitation is invalid, expired, or not issued to this email address' }); }
      organizationId=row.organization_id; assignedRole=row.role;
      await client.query('UPDATE organization_invites SET accepted_at=CURRENT_TIMESTAMP WHERE id=$1',[row.id]);
    } else {
      const existingOrganization = await client.query('SELECT id FROM organizations WHERE lower(name)=lower($1) LIMIT 1',[organizationName]);
      if (existingOrganization.rowCount) { await client.query('ROLLBACK'); return res.status(409).json({ error:'An organization with this name already exists. Ask an administrator to invite you.' }); }
      organizationId=`org_${randomUUID()}`;
      const slugBase=organizationName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'organization';
      let slug=slugBase;
      for(let attempt=0;attempt<5;attempt+=1){
        const suffix=attempt===0?'':`-${attempt+1}`;
        const candidate=`${slugBase.slice(0,100-suffix.length)}${suffix}`;
        const check=await client.query('SELECT 1 FROM organizations WHERE slug=$1 LIMIT 1',[candidate]);
        if(!check.rowCount){slug=candidate;break;}
        if(attempt===4) throw new Error('Organization slug could not be allocated');
      }
      await client.query('INSERT INTO organizations (id,name,slug) VALUES ($1,$2,$3)',[organizationId,organizationName,slug]);
    }

    const passwordHash=await hashPassword(password);
    const created=await client.query(
      `INSERT INTO users (id, organization_id, email, name, role, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, organization_id, email, name, role`,
      [`user_${randomUUID()}`, organizationId, email, name, assignedRole, passwordHash]);
    await client.query('UPDATE users SET password_changed_at=CURRENT_TIMESTAMP WHERE id=$1', [created.rows[0].id]);
    await client.query('COMMIT');

    const user=created.rows[0];
    const verifyToken=createOneTimeToken();
    await pool.query('DELETE FROM email_verification_tokens WHERE user_id=$1 AND used_at IS NULL',[user.id]);
    await pool.query(
      `INSERT INTO email_verification_tokens (id,user_id,token_hash,expires_at)
       VALUES ($1,$2,$3,CURRENT_TIMESTAMP + INTERVAL '24 hours')`,
      [`verify_${randomUUID()}`,user.id,hashOneTimeToken(verifyToken)]);
    const verificationUrl=`${appUrl()}/?verify=${encodeURIComponent(verifyToken)}`;
    try {
      await sendSecurityEmail({
        to:email,subject:'Verify your Vortex One email address',
        text:`Verify your Vortex One account within 24 hours: ${verificationUrl}`
      });
    } catch(error) { console.error('Verification email failed:',error); }

    return res.status(201).json({
      verificationRequired:true,
      verificationUrl:process.env.NODE_ENV==='production'?undefined:verificationUrl,
      email:email
    });
  } catch(error:any) {
    try { await client.query('ROLLBACK'); } catch {}
    if(error?.code==='23505') return res.status(409).json({error:'An account or organization with these details already exists'});
    console.error('PostgreSQL signup error:',error);
    return res.status(500).json({error:'Account creation failed'});
  } finally { client.release(); }
}

async function createTenantInvite(req: AuthRequest, res: Response, pool: NonNullable<ReturnType<typeof getPgPool>>) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const role = typeof req.body?.role === 'string' ? req.body.role : 'member';
  const allowedRoles = ['member', 'agent', 'manager', 'executive'];
  if (!email || !/^\\S+@\\S+\\.\\S+$/.test(email)) return res.status(400).json({ error: 'A valid email is required' });
  if (!allowedRoles.includes(role)) return res.status(400).json({ error: 'Invalid invite role' });
  if (!req.dbUser?.organization_id) return res.status(403).json({ error: 'No tenant organization is associated with this account' });
  if (!['admin', 'executive', 'manager'].includes(req.dbUser.role)) return res.status(403).json({ error: 'Only tenant administrators and managers can invite members' });

  const billing = await getOrganizationBilling(pool, req.dbUser.organization_id);
  const seatLimit = Number(billing?.limits?.users ?? planLimits(billing?.plan || 'free').users);
  const seatCount = await pool.query('SELECT COUNT(*)::int AS count FROM users WHERE organization_id=$1 AND disabled_at IS NULL', [req.dbUser.organization_id]);
  if (Number(seatCount.rows[0]?.count || 0) >= seatLimit) {
    return res.status(402).json({ error: 'Seat limit reached', code: 'SEAT_LIMIT_REACHED', limit: seatLimit });
  }

  const existing = await pool.query('SELECT 1 FROM users WHERE organization_id = $1 AND lower(email) = lower($2) LIMIT 1', [req.dbUser.organization_id, email]);
  if (existing.rowCount) return res.status(409).json({ error: 'This person is already a member of your tenant' });

  const rawToken = randomUUID() + randomUUID().replace(/-/g, '');
  await pool.query(
    `INSERT INTO organization_invites (id, organization_id, email, role, token_hash, expires_at, invited_by)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP + INTERVAL '7 days', $6)`,
    [`invite_${randomUUID()}`, req.dbUser.organization_id, email, role, hashSessionToken(rawToken), req.dbUser.id],
  );
  return res.status(201).json({ email, role, token: rawToken, expiresInDays: 7 });
}


async function handleVerifyEmail(req: AuthRequest, res: Response, pool: NonNullable<ReturnType<typeof getPgPool>>) {
  const token=typeof req.body?.token==='string'?req.body.token.trim():'';
  if(!token) return res.status(400).json({error:'Verification token is required'});
  const result=await pool.query(
    `SELECT id,user_id FROM email_verification_tokens
     WHERE token_hash=$1 AND used_at IS NULL AND expires_at>CURRENT_TIMESTAMP LIMIT 1`,
    [hashOneTimeToken(token)]);
  const row=result.rows[0];
  if(!row) return res.status(400).json({error:'Verification link is invalid or expired'});
  await pool.query('UPDATE users SET email_verified_at=COALESCE(email_verified_at,CURRENT_TIMESTAMP) WHERE id=$1',[row.user_id]);
  await pool.query('UPDATE email_verification_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=$1',[row.id]);
  return res.json({verified:true});
}

async function handleRequestPasswordReset(req: AuthRequest, res: Response, pool: NonNullable<ReturnType<typeof getPgPool>>) {
  const email=typeof req.body?.email==='string'?req.body.email.trim().toLowerCase():'';
  if(/^\S+@\S+\.\S+$/.test(email)){
    const user=(await pool.query('SELECT id FROM users WHERE lower(email)=$1 AND disabled_at IS NULL LIMIT 1',[email])).rows[0];
    if(user){
      const token=createOneTimeToken();
      await pool.query('DELETE FROM password_reset_tokens WHERE user_id=$1 AND used_at IS NULL',[user.id]);
      await pool.query(`INSERT INTO password_reset_tokens (id,user_id,token_hash,expires_at)
        VALUES ($1,$2,$3,CURRENT_TIMESTAMP+INTERVAL '30 minutes')`,
        [`reset_${randomUUID()}`,user.id,hashOneTimeToken(token)]);
      const link=`${appUrl()}/?reset=${encodeURIComponent(token)}`;
      try{await sendSecurityEmail({to:email,subject:'Reset your Vortex One password',text:`Reset your Vortex One password within 30 minutes: ${link}`});}
      catch(error){console.error('Password reset email failed:',error);}
    }
  }
  return res.json({accepted:true});
}

async function handleResetPassword(req: AuthRequest, res: Response, pool: NonNullable<ReturnType<typeof getPgPool>>) {
  const token=typeof req.body?.token==='string'?req.body.token.trim():'';
  const password=typeof req.body?.password==='string'?req.body.password:'';
  if(!token||!password) return res.status(400).json({error:'Reset token and password are required'});
  if(password.length<12) return res.status(400).json({error:'Password must be at least 12 characters'});
  const result=await pool.query(`SELECT id,user_id FROM password_reset_tokens
    WHERE token_hash=$1 AND used_at IS NULL AND expires_at>CURRENT_TIMESTAMP LIMIT 1`,[hashOneTimeToken(token)]);
  const row=result.rows[0];
  if(!row) return res.status(400).json({error:'Reset link is invalid or expired'});
  const hash=await hashPassword(password);
  await pool.query('UPDATE users SET password_hash=$1,password_changed_at=CURRENT_TIMESTAMP,email_verified_at=COALESCE(email_verified_at,CURRENT_TIMESTAMP) WHERE id=$2',[hash,row.user_id]);
  await pool.query('UPDATE password_reset_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=$1',[row.id]);
  await pool.query('UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND revoked_at IS NULL',[row.user_id]);
  clearSessionCookie(res);
  return res.json({reset:true});
}

async function handleMfaSetup(req: AuthRequest, res: Response, pool: NonNullable<ReturnType<typeof getPgPool>>) {
  if(!req.dbUser) return res.status(401).json({error:'Unauthorized'});
  const row=(await pool.query('SELECT email,mfa_enabled FROM users WHERE id=$1',[req.dbUser.id])).rows[0];
  if(!row) return res.status(404).json({error:'User not found'});
  if(row.mfa_enabled) return res.status(409).json({error:'MFA is already enabled'});
  const secret=createTotpSecret();
  await pool.query('UPDATE users SET mfa_secret=$1 WHERE id=$2',[encryptMfaSecret(secret),req.dbUser.id]);
  return res.json({secret,otpauthUri:createTotpUri(secret,row.email)});
}

async function handleMfaEnable(req: AuthRequest, res: Response, pool: NonNullable<ReturnType<typeof getPgPool>>) {
  if(!req.dbUser) return res.status(401).json({error:'Unauthorized'});
  const code=typeof req.body?.code==='string'?req.body.code.trim():'';
  const row=(await pool.query('SELECT mfa_secret FROM users WHERE id=$1',[req.dbUser.id])).rows[0];
  if(!row?.mfa_secret) return res.status(400).json({error:'Start MFA setup first'});
  if(!verifyTotp(decryptMfaSecret(row.mfa_secret),code)) return res.status(400).json({error:'Invalid authenticator code'});
  const backupCodes=generateBackupCodes();
  await pool.query('UPDATE users SET mfa_enabled=true,mfa_backup_codes=$1::jsonb WHERE id=$2',[JSON.stringify(await hashBackupCodes(backupCodes)),req.dbUser.id]);
  return res.json({enabled:true,backupCodes});
}

async function handleMfaDisable(req: AuthRequest, res: Response, pool: NonNullable<ReturnType<typeof getPgPool>>) {
  if(!req.dbUser) return res.status(401).json({error:'Unauthorized'});
  const password=typeof req.body?.password==='string'?req.body.password:'';
  const row=(await pool.query('SELECT password_hash FROM users WHERE id=$1',[req.dbUser.id])).rows[0];
  if(!row?.password_hash||!(await verifyPassword(password,row.password_hash))) return res.status(401).json({error:'Current password is required'});
  await pool.query("UPDATE users SET mfa_enabled=false,mfa_secret=NULL,mfa_backup_codes='[]'::jsonb WHERE id=$1",[req.dbUser.id]);
  return res.json({enabled:false});
}

async function handleMfaVerify(req: AuthRequest, res: Response, pool: NonNullable<ReturnType<typeof getPgPool>>) {
  const challengeToken=typeof req.body?.challengeToken==='string'?req.body.challengeToken.trim():'';
  const code=typeof req.body?.code==='string'?req.body.code.trim().replace(/-/g,'').toUpperCase():'';
  if(!challengeToken||!code) return res.status(400).json({error:'MFA challenge and code are required'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const result=await client.query(`SELECT c.id,c.user_id,c.attempts,u.email,u.name,u.role,u.organization_id,u.mfa_secret,u.mfa_backup_codes,
      o.name AS organization_name,o.slug AS organization_slug,o.settings AS organization_settings
      FROM auth_mfa_challenges c JOIN users u ON u.id=c.user_id JOIN organizations o ON o.id=u.organization_id
      WHERE c.challenge_hash=$1 AND c.expires_at>CURRENT_TIMESTAMP AND u.disabled_at IS NULL FOR UPDATE`,
      [hashOneTimeToken(challengeToken)]);
    const row=result.rows[0];
    if(!row||row.attempts>=5){await client.query('ROLLBACK');return res.status(401).json({error:'MFA challenge is invalid or expired'});}
    const totpValid=row.mfa_secret?verifyTotp(decryptMfaSecret(row.mfa_secret),code):false;
    const backups=Array.isArray(row.mfa_backup_codes)?row.mfa_backup_codes:[];
    const backupIndex=totpValid?-1:backups.findIndex((hash:string)=>hashOneTimeToken(code)===hash);
    if(!totpValid&&backupIndex<0){
      await client.query('UPDATE auth_mfa_challenges SET attempts=attempts+1 WHERE id=$1',[row.id]);
      await client.query('COMMIT');
      return res.status(401).json({error:'Invalid MFA code'});
    }
    if(backupIndex>=0){backups.splice(backupIndex,1);await client.query('UPDATE users SET mfa_backup_codes=$1::jsonb WHERE id=$2',[JSON.stringify(backups),row.user_id]);}
    await client.query('DELETE FROM auth_mfa_challenges WHERE id=$1',[row.id]);
    await client.query('UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=$1',[row.user_id]);
    await client.query('COMMIT');
    const token=await issueSession(pool,row.user_id,req,res,{mfaVerified:true});
    return res.json({token,user:{id:row.user_id,organization_id:row.organization_id,organization_name:row.organization_name,organization_slug:row.organization_slug,organization_settings:row.organization_settings,email:row.email,name:row.name,role:row.role}});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}

async function listSessions(req: AuthRequest, res: Response, pool: NonNullable<ReturnType<typeof getPgPool>>) {
  if(!req.dbUser) return res.status(401).json({error:'Unauthorized'});
  const token=getSessionToken(req);
  const currentHash=token?hashSessionToken(token):'';
  const result=await pool.query(`SELECT id,user_agent,ip_address,created_at,last_seen_at,expires_at,mfa_verified_at,
    (token_hash=$2) AS current FROM auth_sessions
    WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>CURRENT_TIMESTAMP ORDER BY last_seen_at DESC`,
    [req.dbUser.id,currentHash]);
  return res.json({sessions:result.rows});
}

async function revokeOtherSessions(req: AuthRequest,res: Response,pool: NonNullable<ReturnType<typeof getPgPool>>){
  if(!req.dbUser)return res.status(401).json({error:'Unauthorized'});
  const token=getSessionToken(req); const currentHash=token?hashSessionToken(token):'';
  await pool.query('UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND token_hash<>$2 AND revoked_at IS NULL',[req.dbUser.id,currentHash]);
  return res.json({revoked:true});
}

async function organizationSettings(req: AuthRequest,res: Response,pool: NonNullable<ReturnType<typeof getPgPool>>){
  if(!req.dbUser)return res.status(401).json({error:'Unauthorized'});
  if(req.method==='PATCH'&&!['admin','executive'].includes(req.dbUser.role))return res.status(403).json({error:'Organization administrator access required'});
  if(req.method==='PATCH'){
    const body=req.body&&typeof req.body==='object'?req.body:{};
    if(body.name!==undefined&&(!String(body.name).trim()||String(body.name).length>255))return res.status(400).json({error:'Invalid organization name'});
    if(body.billing_email!==undefined&&body.billing_email&&!/^\S+@\S+\.\S+$/.test(String(body.billing_email)))return res.status(400).json({error:'Invalid billing email'});
    const current=(await pool.query('SELECT settings FROM organizations WHERE id=$1',[req.dbUser.organization_id])).rows[0];
    const settings=body.settings&&typeof body.settings==='object'?body.settings:current?.settings||{};
    await pool.query('UPDATE organizations SET name=COALESCE($1,name),billing_email=COALESCE($2,billing_email),timezone=COALESCE($3,timezone),settings=$4::jsonb,updated_at=CURRENT_TIMESTAMP WHERE id=$5',
      [body.name?.trim(),body.billing_email?.trim(),body.timezone,JSON.stringify(settings),req.dbUser.organization_id]);
  }
  const row=(await pool.query('SELECT id,name,slug,billing_email,timezone,settings FROM organizations WHERE id=$1',[req.dbUser.organization_id])).rows[0];
  return res.json({organization:row});
}

async function billingAndUsage(req: AuthRequest,res: Response,pool: NonNullable<ReturnType<typeof getPgPool>>){
  if(!req.dbUser)return res.status(401).json({error:'Unauthorized'});
  const billing=(await pool.query('SELECT plan,subscription_status,trial_ends_at,current_period_start,current_period_end,cancel_at_period_end,limits FROM organization_billing WHERE organization_id=$1',[req.dbUser.organization_id])).rows[0]
    || {plan:'free',subscription_status:'active',limits:{}};
  const usage=(await pool.query(`SELECT metric,used FROM organization_usage WHERE organization_id=$1 AND period_start=date_trunc('month',CURRENT_DATE)::date`,[req.dbUser.organization_id])).rows;
  return res.json({billing,usage:Object.fromEntries(usage.map((row:any)=>[row.metric,Number(row.used)]))});
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const pool=getPgPool();
  if(!pool)return res.status(503).json({error:'Database unavailable'});
  try{
    await ensurePostgreSQLAuthSchema(pool);

    if(req.path==='/auth/login'&&req.method==='POST')return handleLogin(req,res,pool);
    if(req.path==='/auth/signup'&&req.method==='POST')return handleSignup(req,res,pool);
    if(req.path==='/auth/verify-email'&&req.method==='POST')return handleVerifyEmail(req,res,pool);
    if(req.path==='/auth/password-reset/request'&&req.method==='POST')return handleRequestPasswordReset(req,res,pool);
    if(req.path==='/auth/password-reset/confirm'&&req.method==='POST')return handleResetPassword(req,res,pool);
    if(req.path==='/auth/mfa/verify'&&req.method==='POST')return handleMfaVerify(req,res,pool);

    const token=getSessionToken(req);
    if(!token)return res.status(401).json({error:'Unauthorized: Missing session'});
    const tokenHash=hashSessionToken(token);
    const {rows}=await pool.query(`SELECT u.id,u.organization_id,u.email,u.name,u.role
      FROM auth_sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=$1 AND s.expires_at>CURRENT_TIMESTAMP AND s.revoked_at IS NULL
        AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL LIMIT 1`,[tokenHash]);
    const dbUser=rows[0];
    if(!dbUser)return res.status(401).json({error:'Unauthorized: Invalid or expired session'});
    req.dbUser=dbUser;
    req.user={uid:dbUser.id,email:dbUser.email,name:dbUser.name,role:dbUser.role};
    await pool.query('UPDATE auth_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE token_hash=$1',[tokenHash]);

    const organizationId = canonicalizeOrganizationContext(req);
    const client = await pool.connect();
    const context = await beginTenantContext(client, organizationId);
    let settled = false;
    const finish = (commit: boolean) => {
      if (settled) return;
      settled = true;
      void finishTenantContext(context, commit).catch((error) => {
        console.error('Tenant database transaction finalization failed:', error);
      });
    };
    res.once('finish', () => finish(res.statusCode < 400));
    res.once('close', () => {
      if (!res.writableEnded) finish(false);
    });
    enterTenantContext(context);

    if(req.path==='/auth/logout'&&req.method==='POST'){
      await pool.query('UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=$1',[tokenHash]);
      clearSessionCookie(res);
      return res.status(204).send();
    }
    if(req.path==='/auth/me'&&req.method==='GET'){
      const user=(await pool.query(`SELECT u.id,u.email,u.name,u.role,u.created_at,u.last_login_at,u.email_verified_at,u.mfa_enabled,
        o.id AS organization_id,o.name AS organization_name,o.slug AS organization_slug,o.billing_email,o.timezone,o.settings
        FROM users u JOIN organizations o ON o.id=u.organization_id WHERE u.id=$1`,[dbUser.id])).rows[0];
      return res.json({user});
    }
    if(req.path==='/auth/sessions'&&req.method==='GET')return listSessions(req,res,pool);
    if(req.path==='/auth/sessions/revoke-others'&&req.method==='POST')return revokeOtherSessions(req,res,pool);
    if(req.path==='/auth/mfa/setup'&&req.method==='POST')return handleMfaSetup(req,res,pool);
    if(req.path==='/auth/mfa/enable'&&req.method==='POST')return handleMfaEnable(req,res,pool);
    if(req.path==='/auth/mfa/disable'&&req.method==='POST')return handleMfaDisable(req,res,pool);
    if(req.path==='/tenant/invites'&&req.method==='POST')return createTenantInvite(req,res,pool);
    if(req.path==='/tenant/invites'&&req.method==='GET'){
      if(!['admin','executive','manager'].includes(dbUser.role))return res.status(403).json({error:'Organization administrator access required'});
      const invites=(await pool.query(`SELECT id,email,role,expires_at,accepted_at,created_at FROM organization_invites
        WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100`,[dbUser.organization_id])).rows;
      return res.json({invites});
    }
    if(req.path==='/organization/settings'&&(req.method==='GET'||req.method==='PATCH'))return organizationSettings(req,res,pool);
    if(req.path==='/organization/billing'&&req.method==='GET')return billingAndUsage(req,res,pool);
    if(req.path==='/organization/billing/checkout'&&req.method==='POST'){
      if(!['admin','executive'].includes(dbUser.role))return res.status(403).json({error:'Organization administrator access required'});
      const plan=String(req.body?.plan||'') as 'starter'|'professional'|'enterprise';
      if(!['starter','professional','enterprise'].includes(plan))return res.status(400).json({error:'Invalid billing plan'});
      try{return res.json(await createCheckoutSession(pool,dbUser.organization_id,plan,dbUser.email));}
      catch(error:any){return res.status(502).json({error:error.message||'Unable to create checkout session'});}
    }
    if(req.path==='/organization/billing/portal'&&req.method==='POST'){
      if(!['admin','executive'].includes(dbUser.role))return res.status(403).json({error:'Organization administrator access required'});
      try{return res.json(await createPortalSession(pool,dbUser.organization_id));}
      catch(error:any){return res.status(502).json({error:error.message||'Unable to create billing portal session'});}
    }

    try {
      next();
    } catch (error) {
      finish(false);
      throw error;
    }
    return;
  }catch(error:any){
    if(error instanceof AuthorizationError)return res.status(error.statusCode).json({error:error.message});
    console.error('PostgreSQL authentication error:',error);
    return res.status(500).json({error:'Authentication service unavailable'});
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized: User not found in DB' });
    if (!roles.includes(req.dbUser.role)) return res.status(403).json({ error: `Forbidden: Requires one of roles: ${roles.join(', ')}` });
    next();
  };
};