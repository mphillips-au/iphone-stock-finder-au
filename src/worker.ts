import { cached } from './lib/telstra/cache';
import { context, upstream } from './lib/telstra/http';
import { normaliseGeo, object } from './lib/telstra/normalise';
import { getProducts } from './lib/telstra/products';
import { stockPage } from './lib/telstra/stock';
import type { PageInput } from './shared/types';
interface Env { ASSETS: Fetcher; SKU_BATCH_SIZE?: string; DEBUG_UPSTREAM?: string }
export function validatePage(value: unknown): PageInput {
  const v = object(value);
  if (typeof v.lat !== 'number' || !Number.isFinite(v.lat) || v.lat < -44 || v.lat > -9 ||
      typeof v.lon !== 'number' || !Number.isFinite(v.lon) || v.lon < 112 || v.lon > 154 ||
      !Number.isInteger(v.from) || Number(v.from) < 0 || Number(v.from) > 10000 || Number(v.from) % 10 !== 0 || v.size !== 10 ||
      !Array.isArray(v.skus) || v.skus.length < 1 || v.skus.length > 60 || v.skus.some(s => typeof s !== 'string' || !/^\d{9}$/.test(s))) throw new Error('Invalid page request');
  return { lat: v.lat, lon: v.lon, from: Number(v.from), size: 10, skus: [...new Set(v.skus as string[])].sort() };
}
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) return json({ error: 'Use this API from the stock finder.' }, 403);
    const cache = (caches as unknown as { default: Cache }).default;
    try {
      if (url.pathname === '/api/products' && request.method === 'GET') return json(await cached('products-v3', 1800, () => getProducts(fetch, env.DEBUG_UPSTREAM === 'true'), cache));
      if (url.pathname === '/api/location' && request.method === 'GET') {
        const query = (url.searchParams.get('q') ?? '').trim();
        if (query.length < 2 || query.length > 80) return json({ error: 'Enter a suburb or postcode.' }, 400);
        const results = await cached(`geo-v1:${query.toLowerCase()}`, 86400, async () => {
          const raw = await upstream('https://prod.okapi.ogw.evolve.okapi.telstra.com/tcom-ext/v1/geo/unstructured', { query, granularity: ['SUBURB', 'POSTCODE'], pagination: { size: '10' } }, context(), { source: 'tcom' });
          return normaliseGeo(raw);
        }, cache, value => value.length > 0);
        return json(results);
      }
      if (url.pathname === '/api/stock/page' && request.method === 'POST') {
        let input: PageInput;
        try {
          const body = await request.text();
          if (body.length > 5000) return json({ error: 'Request too large.' }, 413);
          input = validatePage(JSON.parse(body));
        } catch { return json({ error: 'Choose a valid Australian location and phone configuration.' }, 400); }
        return json(await cached(`stock-v1:${JSON.stringify(input)}`, 20, () => stockPage(input, Number(env.SKU_BATCH_SIZE) || 6, context(env.DEBUG_UPSTREAM === 'true')), cache, value => value.complete));
      }
      return json({ error: 'API route not found.' }, 404);
    } catch { return json({ error: 'Telstra is not responding right now. Please try again shortly.' }, 502); }
  },
};
