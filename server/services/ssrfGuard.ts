/**
 * SSRF protection for outbound requests to tenant-supplied URLs.
 *
 * Defence layers:
 *  1. URL policy: http(s) only, no embedded credentials, hostname deny-list.
 *  2. Address policy: every resolved address must be a public unicast address (IPv4 and IPv6 are parsed to bytes,
 *     including IPv4-mapped, NAT64, 6to4 and Teredo forms, so textual tricks such as ::ffff:7f00:1 are caught).
 *  3. DNS pinning: the hostname is resolved ONCE, all answers are validated, and the connection is made to the
 *     validated address through the request's `lookup` hook, so a second (rebinding) DNS answer is never used.
 *     TLS SNI / certificate verification and the Host header still use the original hostname.
 *  4. No redirects are followed, the response is size-capped and the whole exchange has a hard timeout.
 */
import http from 'node:http';
import https from 'node:https';
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class SsrfBlockedError extends Error {
  constructor(message: string) { super(message); this.name = 'SsrfBlockedError'; }
}

export interface ResolvedAddress { address: string; family: 4 | 6 }
export type HostResolver = (hostname: string) => Promise<ResolvedAddress[]>;

export const defaultResolver: HostResolver = async (hostname) => {
  const answers = await dnsLookup(hostname, { all: true, verbatim: true });
  return answers.map((a) => ({ address: a.address, family: a.family === 6 ? 6 : 4 }));
};

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata', 'metadata.google', 'metadata.google.internal', 'instance-data']);
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain', '.home.arpa', '.lan', '.intranet', '.corp', '.private'];

export function isBlockedHostname(hostname: string): boolean {
  const h = hostname.replace(/\.$/, '').toLowerCase();
  return BLOCKED_HOSTNAMES.has(h) || BLOCKED_SUFFIXES.some((s) => h.endsWith(s));
}

function ipv4Bytes(address: string): number[] | null {
  const parts = address.split('.');
  if (parts.length !== 4) return null;
  const bytes = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return bytes.some((b) => !(b >= 0 && b <= 255)) ? null : bytes;
}

export function isUnsafeIPv4Bytes([a, b, c]: number[]): boolean {
  return a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224;
}

/** Expands any valid IPv6 text form (including trailing dotted IPv4) to 16 bytes. */
export function ipv6Bytes(address: string): number[] | null {
  let text = address.toLowerCase().split('%')[0];
  const dotted = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const v4 = ipv4Bytes(dotted[1]);
    if (!v4) return null;
    text = text.slice(0, -dotted[1].length) + ((v4[0] << 8) | v4[1]).toString(16) + ':' + ((v4[2] << 8) | v4[3]).toString(16);
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.flatMap((g) => { const n = parseInt(g, 16); return [n >> 8, n & 0xff]; });
}

export function isUnsafeIPv6Bytes(b: number[]): boolean {
  const first96Zero = b.slice(0, 12).every((x) => x === 0);
  if (first96Zero) return true; // ::, ::1 and IPv4-compatible ::a.b.c.d
  const isMapped = b.slice(0, 10).every((x) => x === 0) && b[10] === 0xff && b[11] === 0xff;
  if (isMapped) return true; // IPv4-mapped is never a legitimate public destination
  // Only global unicast 2000::/3 may be contacted.
  if ((b[0] & 0xe0) !== 0x20) return true;
  if (b[0] === 0x20 && b[1] === 0x02) return true; // 6to4 relays: block entirely
  if (b[0] === 0x20 && b[1] === 0x01) {
    if (b[2] === 0 && b[3] === 0) return true;                        // 2001::/32 Teredo
    if (b[2] === 0x0d && b[3] === 0xb8) return true;                  // 2001:db8::/32 documentation
    if (b[2] === 0 && b[3] === 0x02) return true;                     // 2001:2::/48 benchmarking
    if (b[2] === 0 && (b[3] & 0xf0) === 0x10) return true;            // 2001:10::/28 ORCHID
    if (b[2] === 0 && (b[3] & 0xf0) === 0x20) return true;            // 2001:20::/28 ORCHIDv2
  }
  if (b[0] === 0x3f && b[1] === 0xff) return true;                    // 3fff::/20 documentation
  return false;
}

/** True when the address must never be contacted (private, loopback, link-local, reserved, malformed...). */
export function isUnsafeAddress(address: string): boolean {
  const family = isIP(address.replace(/^\[|\]$/g, ''));
  const clean = address.replace(/^\[|\]$/g, '');
  if (family === 4) { const b = ipv4Bytes(clean); return !b || isUnsafeIPv4Bytes(b); }
  if (family === 6) { const b = ipv6Bytes(clean); return !b || isUnsafeIPv6Bytes(b); }
  return true;
}

export interface SafeTarget { url: URL; hostname: string; address: string; family: 4 | 6 }

/** Validates the URL policy and resolves the host once, requiring EVERY answer to be public. */
export async function resolveSafeTarget(value: string, resolver: HostResolver = defaultResolver): Promise<SafeTarget> {
  let url: URL;
  try { url = new URL(value); } catch { throw new SsrfBlockedError('Webhook URL is not a valid URL.'); }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new SsrfBlockedError('Webhook URL must use http:// or https://.');
  if (url.username || url.password) throw new SsrfBlockedError('Webhook URL must not contain credentials.');
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname) throw new SsrfBlockedError('Webhook URL has no host.');
  if (isBlockedHostname(hostname)) throw new SsrfBlockedError('Webhook URL targets a local or metadata host, which is not allowed.');

  if (isIP(hostname)) {
    if (isUnsafeAddress(hostname)) throw new SsrfBlockedError('Webhook URL targets a private, loopback, link-local, multicast, or otherwise reserved IP address.');
    return { url, hostname, address: hostname, family: isIP(hostname) === 6 ? 6 : 4 };
  }
  const answers = await resolver(hostname);
  if (!answers.length || answers.some((a) => isUnsafeAddress(a.address))) {
    throw new SsrfBlockedError('Webhook hostname resolves to a private, loopback, link-local, multicast, or otherwise reserved IP address.');
  }
  return { url, hostname, address: answers[0].address, family: answers[0].family };
}

export interface SafeRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  resolver?: HostResolver;
  /** Test seam: replaces http(s).request so no socket is opened. Receives the pinned address. */
  transport?: (target: SafeTarget, options: http.RequestOptions, body: string | undefined) => Promise<SafeResponse>;
}

export interface SafeResponse { ok: boolean; status: number; body: string; truncated: boolean }

/** Performs the HTTP request against the validated, pinned address. Redirects are returned, never followed. */
export async function safeHttpRequest(value: string, opts: SafeRequestOptions = {}): Promise<SafeResponse> {
  const target = await resolveSafeTarget(value, opts.resolver);
  const { url } = target;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const maxBytes = opts.maxResponseBytes ?? 64 * 1024;
  const headers = { ...(opts.headers ?? {}) };
  if (opts.body !== undefined) headers['content-length'] = String(Buffer.byteLength(opts.body));
  const isHttps = url.protocol === 'https:';
  const requestOptions: http.RequestOptions & https.RequestOptions = {
    protocol: url.protocol,
    hostname: target.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: `${url.pathname}${url.search}`,
    method: opts.method ?? 'POST',
    headers,
    // Pin the connection to the address validated above; never consult DNS again.
    lookup: ((_host: string, options: any, cb: any) => {
      if (options && options.all) cb(null, [{ address: target.address, family: target.family }]);
      else cb(null, target.address, target.family);
    }) as any,
    ...(isHttps ? { servername: isIP(target.hostname) ? undefined : target.hostname } : {}),
    agent: false,
  };
  if (opts.transport) return opts.transport(target, requestOptions, opts.body);

  return new Promise<SafeResponse>((resolve, reject) => {
    const req = (isHttps ? https : http).request(requestOptions, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      let truncated = false;
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) { truncated = true; res.destroy(); return; }
        chunks.push(chunk);
      });
      const finish = () => {
        clearTimeout(timer);
        const status = res.statusCode ?? 0;
        resolve({ ok: status >= 200 && status < 300, status, body: Buffer.concat(chunks).toString('utf8'), truncated });
      };
      res.on('end', finish);
      res.on('close', () => { if (truncated) finish(); });
      res.on('error', () => { if (truncated) finish(); });
    });
    const timer = setTimeout(() => req.destroy(new Error('Webhook request timed out')), timeoutMs);
    req.on('error', (err) => { clearTimeout(timer); reject(err); });
    if (opts.body !== undefined) req.write(opts.body);
    req.end();
  });
}
