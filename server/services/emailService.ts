import nodemailer, { type Transporter } from 'nodemailer';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  from?: string;
  html?: string;
  headers?: Record<string, string>;
}

export interface EmailSendResult {
  messageId: string;
}

/** Minimal SMTP transport contract for tests and legacy SMTP providers. */
export interface EmailTransport {
  sendMail(message: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
    headers?: Record<string, string>;
  }): Promise<{ messageId?: string; rejected?: unknown[] }>;
}

const EMAIL_PATTERN = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Email provider is not configured: missing ${name}`);
  return value;
}

/** Header values must never carry line breaks (header injection). */
function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

let injectedTransport: EmailTransport | null = null;
let cachedTransport: Transporter | null = null;

/** Replaces SMTP transport for tests. Pass null to restore provider selection. */
export function setEmailTransport(transport: EmailTransport | null): void {
  injectedTransport = transport;
}

function smtpTransport(): EmailTransport {
  if (!cachedTransport) {
    const host = required('SMTP_HOST');
    const port = Number(process.env.SMTP_PORT || 587);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error('Invalid SMTP configuration');
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASSWORD;
    cachedTransport = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      requireTLS: process.env.SMTP_REQUIRE_TLS !== 'false' && port !== 25,
      auth: user && pass ? { user, pass } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      tls: { rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false' },
    });
  }
  return cachedTransport as unknown as EmailTransport;
}

/** Sends via the Resend HTTPS API (used when RESEND_API_KEY is configured) and redacts provider error bodies. */
async function sendWithResend(message: EmailMessage, from: string): Promise<EmailSendResult> {
  const apiKey = required('RESEND_API_KEY');
  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [singleLine(message.to)],
        subject: singleLine(message.subject),
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
        ...(message.headers ? { headers: message.headers } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    const name = (error as { name?: string })?.name;
    throw new Error(`Email delivery failed (${name === 'TimeoutError' ? 'ETIMEDOUT' : 'NETWORK_ERROR'})`);
  }

  if (!response.ok) {
    // Do not expose provider response bodies or credentials in application errors.
    throw new Error(`Email delivery failed (RESEND_HTTP_${response.status})`);
  }

  let result: { id?: string };
  try {
    result = await response.json() as { id?: string };
  } catch {
    throw new Error('Email delivery failed (RESEND_INVALID_RESPONSE)');
  }
  if (!result.id) throw new Error('Email delivery failed (RESEND_INVALID_RESPONSE)');
  return { messageId: result.id };
}

/** Sends an email via Resend when configured, falling back to the SMTP transport otherwise. */
export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  if (!EMAIL_PATTERN.test(message.to)) throw new Error('Invalid recipient email');
  const from = singleLine(message.from?.trim() || process.env.RESEND_FROM?.trim() || process.env.SMTP_FROM?.trim() || required('RESEND_FROM'));
  if (!injectedTransport && process.env.RESEND_API_KEY?.trim()) return sendWithResend(message, from);
  const transport = injectedTransport ?? smtpTransport();
  let info: Awaited<ReturnType<EmailTransport['sendMail']>>;
  try {
    info = await transport.sendMail({
      from,
      to: singleLine(message.to),
      subject: singleLine(message.subject),
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
      ...(message.headers ? { headers: message.headers } : {}),
    });
  } catch (error) {
    // Provider errors can echo the SMTP conversation; surface a stable message and keep credentials out of it.
    const code = (error as { code?: string; responseCode?: number })?.code || (error as { responseCode?: number })?.responseCode;
    throw new Error(`Email delivery failed${code ? ` (${code})` : ''}`);
  }
  if (info.rejected && info.rejected.length > 0) throw new Error('Email recipient was rejected by the provider');
  return { messageId: info.messageId || `smtp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}` };
}
