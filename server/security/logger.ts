/** Structured security/audit logging with secret redaction. Never log raw tokens, passwords, or request bodies. */
const SENSITIVE_KEY = /(pass(word)?|secret|token|authorization|cookie|api[-_]?key|signature|credential|private|code)$/i;
const SENSITIVE_VALUE = /(Bearer\s+[A-Za-z0-9._~+/-]+=*|whsec_[A-Za-z0-9]+|sk_(live|test)_[A-Za-z0-9]+|postgres(ql)?:\/\/[^\s]+)/g;

export function redact(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return value.replace(SENSITIVE_VALUE, '[REDACTED]');
  if (typeof value !== 'object') return value;
  if (depth > 5) return '[TRUNCATED]';
  if (value instanceof Error) return { name: value.name, message: redact(value.message) };
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : redact(v, depth + 1);
  }
  return out;
}

export function securityEvent(event: string, details: Record<string, unknown> = {}): void {
  console.warn(JSON.stringify({ level: 'security', event, at: new Date().toISOString(), ...(redact(details) as object) }));
}

export function logError(context: string, error: unknown): void {
  const e = error as { name?: string; message?: string; code?: string };
  console.error(JSON.stringify({ level: 'error', context, name: e?.name, code: e?.code, message: redact(String(e?.message ?? error)) }));
}

/**
 * Message safe to return to a client for an unexpected (5xx) failure: the detail is logged server-side
 * (redacted) and the client receives only the generic fallback — no SQL, hostnames, paths or stack traces.
 */
export function safeErrorMessage(error: unknown, fallback: string): string {
  logError(fallback, error);
  return fallback;
}
