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

const INTERNAL_ERROR_NAMES = new Set(['TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'EvalError', 'URIError', 'AggregateError', 'DatabaseError', 'FetchError', 'AbortError']);
/** Fragments that indicate infrastructure detail (drivers, sockets, SQL, file paths, credentials) rather than a user-facing reason. */
const INTERNAL_MESSAGE = /(ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EPIPE|socket hang up|getaddrinfo|fetch failed|relation "|column "|syntax error at|violates .* constraint|duplicate key|permission denied for|password authentication|certificate|self[- ]signed|\bat \S+:\d+:\d+|\/(app|home|usr|var|tmp|opt)\/|node_modules|postgres(ql)?:\/\/|Bearer\s|whsec_|sk_(live|test)_)/i;

/**
 * True when an error is an unexpected/internal failure whose message must not reach a client: PostgreSQL driver errors,
 * Node system errors, wrapped provider/HTTP errors, JavaScript runtime errors, explicit 5xx errors, and any message that
 * contains infrastructure detail. Deliberate application errors (e.g. `throw new Error('run_at is required')`) and errors
 * carrying an explicit 4xx status are NOT internal, so their messages remain visible to the user.
 */
export function isInternalError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return true;
  const e = error as Record<string, any>;
  const message = typeof e.message === 'string' ? e.message : '';
  if (!message || message.length > 300 || INTERNAL_MESSAGE.test(message)) return true;
  const status = typeof e.statusCode === 'number' ? e.statusCode : typeof e.status === 'number' ? e.status : undefined;
  if (status !== undefined && status >= 400 && status < 500) return false;
  if (status !== undefined && status >= 500) return true;
  if (e.severity && e.routine) return true; // node-postgres DatabaseError
  if (typeof e.errno === 'number' || typeof e.syscall === 'string') return true; // Node system error
  if (e.response || e.request || e.cause) return true; // wrapped HTTP/provider error
  return INTERNAL_ERROR_NAMES.has(String(e.name));
}

/**
 * Client-facing message for a caught error: the application's own validation/business message when it is safe,
 * otherwise the fallback (with the real detail logged server-side, redacted).
 */
export function clientErrorMessage(error: unknown, fallback: string): string {
  if (isInternalError(error)) return safeErrorMessage(error, fallback);
  return String((error as { message: string }).message);
}
