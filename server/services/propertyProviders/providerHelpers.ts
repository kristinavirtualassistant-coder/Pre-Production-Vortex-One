/**
 * Vortex One - Property Provider HTTP Utilities
 * Network helpers for official county data providers.
 */


/**
 * Fetch wrapper with timeout and robust error resilience
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 3000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'VortexOne-Intelligence/1.0',
        ...(options.headers || {}),
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch wrapper with retry and timeout
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 2,
  timeoutMs = 3000
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);
      if (response.ok) return response;
      if (response.status === 429) { // Rate limited, wait a bit
         await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
         continue;
      }
    } catch (err) {
      if (i === retries - 1) throw err;
    }
    await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
  }
  return await fetchWithTimeout(url, options, timeoutMs);
}


/** Legacy test/development fixture helper. Never used by production property providers. */
export function generateUniqueContacts(seed: string, areaCode: string, ownerName: string) {
  if (process.env.NODE_ENV === 'production') throw new Error('Synthetic contact generation is disabled in production');
  return { phones: [], emails: [] };
}
