/**
 * HTTP utilities for authoritative property data providers.
 */

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 3000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': 'VortexOne-Intelligence/1.0', ...(options.headers || {}) },
    });
  } finally { clearTimeout(timeoutId); }
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 2,
  timeoutMs = 3000
): Promise<Response> {
  for (let i=0;i<retries;i++) {
    try {
      const response=await fetchWithTimeout(url,options,timeoutMs);
      if(response.ok) return response;
      if(response.status===429) await new Promise(r=>setTimeout(r,1000*(i+1)));
    } catch(err) { if(i===retries-1) throw err; }
    await new Promise(r=>setTimeout(r,500*(i+1)));
  }
  return fetchWithTimeout(url,options,timeoutMs);
}
