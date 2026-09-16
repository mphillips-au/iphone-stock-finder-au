const inflight = new Map<string, Promise<unknown>>();
export async function cached<T>(key: string, ttl: number, load: () => Promise<T>, cache?: Cache, shouldCache: (value: T) => boolean = () => true): Promise<T> {
  const request = new Request(`https://stock-finder-cache.local/${encodeURIComponent(key)}`);
  if (cache) { const hit = await cache.match(request); if (hit) return await hit.json() as T; }
  const pending = inflight.get(key); if (pending) return pending as Promise<T>;
  const work = (async () => {
    const result = await load();
    if (cache && shouldCache(result)) await cache.put(request, Response.json(result, { headers: { 'Cache-Control': `public, max-age=${ttl}` } })).catch(() => {});
    return result;
  })();
  inflight.set(key, work);
  try { return await work; } finally { inflight.delete(key); }
}
