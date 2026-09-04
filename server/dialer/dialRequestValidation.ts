export type DialRequestValidation =
  | { ok: true; phoneNumber: string }
  | { ok: false; error: string };

export function validateDialRequest(body: unknown): DialRequestValidation {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Dial request body is required' };
  }

  const phoneNumber = (body as { phone_number?: unknown }).phone_number;
  if (typeof phoneNumber !== 'string' || phoneNumber.trim().length === 0) {
    return { ok: false, error: 'phone_number is required' };
  }

  return { ok: true, phoneNumber: phoneNumber.trim() };
}
