/**
 * Baseline browser security headers for every response (API and frontend).
 *
 * The enforced Content-Security-Policy contains only directives that cannot break the app's own scripts, styles, maps
 * or provider calls: it blocks clickjacking (frame-ancestors), <base> hijacking, plugin content and cross-site form
 * posts. A full resource policy is sent as Content-Security-Policy-Report-Only so violations surface in the browser
 * console first; promote it to enforced once it has run cleanly in staging.
 */
import type { RequestHandler } from 'express';

export const ENFORCED_CSP = ["frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'", "form-action 'self'"].join('; ');

export const REPORT_ONLY_CSP = [
  "default-src 'self'",
  "script-src 'self' https://maps.googleapis.com https://accounts.google.com https://apis.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.googleapis.com https://accounts.google.com wss: ws:",
  "frame-src 'self' https://docs.google.com https://accounts.google.com",
  "media-src 'self' blob: data: https:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join('; ');

/** The dialer needs the microphone and the maps may use location; everything else powerful is disabled. */
export const PERMISSIONS_POLICY = 'microphone=(self), geolocation=(self), camera=(), payment=(), usb=(), interest-cohort=()';

export function securityHeaders(options: { production?: boolean } = {}): RequestHandler {
  const production = options.production ?? process.env.NODE_ENV === 'production';
  return (_req, res, next) => {
    res.setHeader('Content-Security-Policy', ENFORCED_CSP);
    res.setHeader('Content-Security-Policy-Report-Only', REPORT_ONLY_CSP);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
    // Allow OAuth popups (Google/Microsoft integrations) to message back while isolating the window otherwise.
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    // HSTS only in production (HTTPS terminates at the platform proxy); never on plain-http local development.
    if (production) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  };
}
