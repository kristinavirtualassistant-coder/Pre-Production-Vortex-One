/**
 * Request-size and payload hardening.
 *  - Small default JSON/urlencoded limits applied BEFORE authentication (an unauthenticated caller can only make
 *    the server buffer a few hundred KB). Routes that legitimately take larger bodies are listed in
 *    LARGE_BODY_PREFIXES, skipped here and parsed with a bounded larger limit only AFTER authentication.
 *  - Prototype-pollution keys are rejected.
 *  - Body-parser failures become safe JSON errors (no stack, no HTML).
 */
import express, { type ErrorRequestHandler, type NextFunction, type Request, type RequestHandler, type Response } from 'express';

export const DEFAULT_JSON_LIMIT = process.env.JSON_BODY_LIMIT || '256kb';
export const LARGE_JSON_LIMIT = process.env.LARGE_JSON_BODY_LIMIT || '10mb';
export const LARGE_BODY_PREFIXES = ['/api/import-data', '/api/import/', '/api/properties/bulk-tags', '/api/imported-files'];

const isLargeBodyPath = (path: string) => LARGE_BODY_PREFIXES.some((p) => path === p || path.startsWith(p.endsWith('/') ? p : `${p}/`));

const smallJson = express.json({ limit: DEFAULT_JSON_LIMIT });
const smallUrlencoded = express.urlencoded({ extended: false, limit: '100kb', parameterLimit: 200 });
const largeJson = express.json({ limit: LARGE_JSON_LIMIT });

/** Pre-auth parsers; large-body routes are deferred to largeBodyParser. */
export const defaultBodyParsers: RequestHandler[] = [
  (req, res, next) => (isLargeBodyPath(req.path) ? next() : smallJson(req, res, next)),
  (req, res, next) => (isLargeBodyPath(req.path) ? next() : smallUrlencoded(req, res, next)),
];

/** Mount AFTER authentication: bounded larger limit for bulk import style routes only. */
export const largeBodyParser: RequestHandler = (req, res, next) => (isLargeBodyPath(req.path) ? largeJson(req, res, next) : next());

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 20;

function hasForbiddenKey(value: unknown, depth = 0): boolean {
  if (depth > MAX_DEPTH) return true;
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((v) => hasForbiddenKey(v, depth + 1));
  for (const key of Object.keys(value as object)) {
    if (FORBIDDEN_KEYS.has(key) || hasForbiddenKey((value as any)[key], depth + 1)) return true;
  }
  return false;
}

/** Rejects bodies containing prototype-pollution keys or nesting deeper than MAX_DEPTH. */
export const rejectUnsafeBodies: RequestHandler = (req, res, next) => {
  if (req.body && typeof req.body === 'object' && hasForbiddenKey(req.body)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  next();
};

/** Final JSON error handler: never leaks stacks, internals or HTML. */
export const jsonErrorHandler: ErrorRequestHandler = (err, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);
  const status = Number(err?.status ?? err?.statusCode);
  if (err?.type === 'entity.too.large' || status === 413) return res.status(413).json({ error: 'Request body too large' });
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) return res.status(400).json({ error: 'Malformed request body' });
  if (err?.type === 'encoding.unsupported' || err?.type === 'charset.unsupported') return res.status(415).json({ error: 'Unsupported content encoding' });
  if (status >= 400 && status < 500) return res.status(status).json({ error: 'Bad request' });
  console.error('[Error] Unhandled request error:', req.method, req.path, err?.message);
  return res.status(500).json({ error: 'Internal server error' });
};

/** Maps TRUST_PROXY ("1", "true", "loopback", "10.0.0.0/8,...") to Express's trust proxy setting; default off. */
export function resolveTrustProxy(raw = process.env.TRUST_PROXY): boolean | number | string {
  const value = raw?.trim();
  if (!value || value === 'false' || value === '0') return false;
  if (value === 'true') return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}
