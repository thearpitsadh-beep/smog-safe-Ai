/**
 * Streaming, byte-bounded JSON for trusted upstream providers.
 * Bounds apply to the decoded response body, including chunked transfer encoding.
 * No response.text() or response.json() is called before the size check.
 */
export async function readBoundedJSON(response, { maxBytes = 1_000_000 } = {}) {
  if (!Number.isInteger(maxBytes) || maxBytes < 32) throw new RangeError('Invalid response size cap');
  const reported = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(reported) && reported > maxBytes) throw new Error('Provider payload too large');
  if (!response.body || typeof response.body.getReader !== 'function') throw new Error('Provider returned empty response');

  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  let completed = false;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) { completed = true; break; }
      if (!(value instanceof Uint8Array)) throw new Error('Provider returned invalid byte stream');
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error('Provider payload too large');
      chunks.push(value);
    }
  } finally {
    if (!completed) {
      // Release resources as soon as oversized or invalid content is detected.
      try { await reader.cancel(); } catch { /* cancellation is best effort */ }
    }
    reader.releaseLock();
  }
  const raw = Buffer.concat(chunks.map(part => Buffer.from(part)), bytes);
  let data;
  try { data = JSON.parse(new TextDecoder('utf-8', { fatal:true }).decode(raw)); }
  catch { throw new Error('Provider returned malformed JSON'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Provider returned invalid JSON');
  return data;
}

/** Bounded, deduplicated server-side JSON client for fixed upstream providers. */
export function createProviderClient({maxEntries=240, maxBytes=1_000_000, request=(...args)=>fetch(...args), now=()=>Date.now()}={}) {
  const cache = new Map();
  const inFlight = new Map();
  return async function remoteJSON(url, ttlMs, timeoutMs=9500) {
    const key = url.toString(), cached = cache.get(key);
    if (cached && now() - cached.created < ttlMs) return {data:structuredClone(cached.data),cacheHit:true};
    if (inFlight.has(key)) return {data:structuredClone(await inFlight.get(key)),cacheHit:true};
    const pending = (async () => {
      const response = await request(url, {
        signal:AbortSignal.timeout(timeoutMs),
        headers:{'User-Agent':'SmogSafeAI/4.0','Accept':'application/json'}
      });
      if (!response.ok) throw new Error(`Provider status ${response.status}`);
      const data = await readBoundedJSON(response,{maxBytes});
      cache.set(key,{data:structuredClone(data),created:now()});
      while (cache.size>maxEntries) cache.delete(cache.keys().next().value);
      return data;
    })();
    inFlight.set(key,pending);
    try {return {data:structuredClone(await pending),cacheHit:false};}
    finally {inFlight.delete(key);}
  };
}
