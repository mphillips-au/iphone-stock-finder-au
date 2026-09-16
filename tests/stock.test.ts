import { describe, expect, it, vi } from 'vitest';
import { FALLBACK_PRODUCTS, STORAGE_ORDER, TELSTRA_IMAGE_FALLBACKS } from '../src/data/products';
import { normaliseGeo, normaliseStock } from '../src/lib/telstra/normalise';
import { context } from '../src/lib/telstra/http';
import { stockPage } from '../src/lib/telstra/stock';
import { getProducts, parseProducts } from '../src/lib/telstra/products';
import { available, changes, groupInventory, mergePages, RadiusGuard, sortStores, updateSnapshot } from '../src/shared/scan';
import { DEFAULT_LOCATION, type Stock, type Store } from '../src/shared/types';
import { validatePage } from '../src/worker';
import { cached } from '../src/lib/telstra/cache';
import { hoursToday } from '../src/shared/hours';
import realStock from '../docs/stock-probe.json';
import realGeo from '../docs/geo-probe.json';
const sku = '100256812';
const input = { lat: DEFAULT_LOCATION.lat, lon: DEFAULT_LOCATION.lon, skus: [sku], from: 0, size: 10 as const };
const store = (code = 'A', metres: number | null = 100): Store => ({ code, name: code, address: '', suburb: '', postcode: '', state: 'VIC', latitude: -37.8, longitude: 144.9, distanceMetres: metres, hours: {} });
const stock = (status = 'available', storeCode = 'A', code = sku): Stock => ({ storeCode, sku: code, status, usageType: 'other' });
function payload(count: number, skus = [sku]) {
  return { data: { storeDetails: Array.from({ length: count }, (_, i) => ({ storecode: `S${i}`, title: `Store ${i}`, distance: i * 1000 })), checkProductStockItem: skus.flatMap(s => Array.from({ length: count }, (_, i) => ({ checkedProductStock: { place: { id: `S${i}` }, productStockStatusType: 'available', productStockUsageType: 'other', stockedProduct: { productCharacteristic: [{ name: 'SKU Code Type', value: 'RIMS' }, { name: 'SKU', value: s }] } } }))) } };
}
const mockContext = (handler: (body: typeof input & { products: string[] }) => Response) => context(false, vi.fn(async (_url, init) => handler(JSON.parse(String(init?.body)))) as unknown as typeof fetch, async () => {});
describe('catalogue and real response contracts', () => {
  it('includes the 40 unique supplied variants and exact target SKU', () => {
    expect(FALLBACK_PRODUCTS).toHaveLength(40); expect(new Set(FALLBACK_PRODUCTS.map(p => p.sku)).size).toBe(40);
    expect(FALLBACK_PRODUCTS.find(p => p.sku === sku)).toMatchObject({ model: 'iPhone 18 Pro Max', storage: '512GB', colour: 'Silver' });
    expect(new Set(FALLBACK_PRODUCTS.map(p => p.imageUrl)).size).toBe(3); expect(FALLBACK_PRODUCTS.find(p => p.model === 'iPhone Duo')?.imageUrl).toBe(TELSTRA_IMAGE_FALLBACKS['iPhone Duo']);
    expect(STORAGE_ORDER).toEqual(['256GB', '512GB', '1TB', '2TB']);
  });
  it('normalises the actual stock probe with exact place/store join', () => {
    const result = normaliseStock(realStock, [sku]); expect(result.stores).toHaveLength(10); expect(result.stock).toHaveLength(10);
    expect(result.stores[0]).toMatchObject({ code: 'ABQW', name: 'Port Melbourne', distanceMetres: 342 });
    expect(result.stock[0]).toMatchObject({ storeCode: 'ABQW', sku, status: 'unavailable' });
  });
  it('normalises actual Telstra centrePoint geo shape', () => {
    expect(normaliseGeo(realGeo)[0]).toMatchObject({ lat: -37.83801318, lon: 144.93842178, postcode: '3207' });
    expect(normaliseGeo({ results: [{ centrePoint: { lat: 0, lon: 0 } }] })).toEqual([]);
  });
  it('deduplicates stores and stock and never infers status from usage', () => {
    const p = payload(1); p.data.storeDetails.push(p.data.storeDetails[0]); p.data.checkProductStockItem.push(p.data.checkProductStockItem[0]);
    const result = normaliseStock(p, [sku]); expect(result.stores).toHaveLength(1); expect(result.stock).toHaveLength(1);
    expect(available(result.stock[0])).toBe(true); expect(available(stock('preOrder'))).toBe(false); expect(available(undefined)).toBe(false);
  });
  it('rejects malformed upstream shape and drops unmatched stock joins', () => {
    expect(() => normaliseStock({}, [sku])).toThrow();
    const p = payload(1); p.data.checkProductStockItem[0].checkedProductStock.place.id = 'WRONG';
    expect(normaliseStock(p, [sku]).stock).toEqual([]);
  });
});
describe('page safety, splitting and partial results', () => {
  it('validates Australian coordinates, page increments, size and SKU inputs', () => {
    expect(validatePage(input)).toEqual(input);
    for (const patch of [{ size: 20 }, { from: 1 }, { from: -10 }, { lat: NaN }, { lon: 0 }, { skus: [] }, { skus: ['bad'] }]) expect(() => validatePage({ ...input, ...patch })).toThrow();
  });
  it('increments full pages by 10 and ends on a short or empty page', async () => {
    for (const count of [0, 7, 10]) {
      const ctx = mockContext(body => { expect(body.size).toBe(10); expect(body.from).toBe(20); return Response.json(payload(count)); });
      expect((await stockPage({ ...input, from: 20 }, 6, ctx)).nextFrom).toBe(count === 10 ? 30 : null);
    }
  });
  it('reduces only the 413 batch without increasing store size', async () => {
    const batches: string[][] = [], skus = FALLBACK_PRODUCTS.slice(0, 8).map(p => p.sku);
    const ctx = mockContext(body => { batches.push(body.products); expect(body.size).toBe(10); return body.products.length > 2 ? new Response('', { status: 413 }) : Response.json(payload(10, body.products)); });
    const result = await stockPage({ ...input, skus }, 6, ctx);
    expect(result.complete).toBe(true); expect(result.stock).toHaveLength(80); expect(batches[0]).toHaveLength(6); expect(batches.at(-1)).toHaveLength(2);
  });
  it('preserves successful batches when one fails with no bad-request retries', async () => {
    const skus = FALLBACK_PRODUCTS.slice(0, 2).map(p => p.sku);
    const ctx = mockContext(body => body.products[0] === skus[1] ? new Response('', { status: 400 }) : Response.json(payload(10, body.products)));
    const result = await stockPage({ ...input, skus }, 1, ctx);
    expect(result.failedSkus).toEqual([skus[1]]); expect(result.stock).toHaveLength(10); expect(result.complete).toBe(false); expect(ctx.fetcher).toHaveBeenCalledTimes(2);
  });
  it('retries transient failures at most twice', async () => {
    const ctx = mockContext(() => new Response('', { status: 503 }));
    expect((await stockPage(input, 6, ctx)).failedSkus).toEqual([sku]); expect(ctx.fetcher).toHaveBeenCalledTimes(3);
  });
  it('uses Worker-compatible redirect handling and refuses upstream redirects', async () => {
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => { expect(init?.redirect).toBe('manual'); return new Response('', { status: 302, headers: { Location: 'https://example.com' } }); });
    const result = await stockPage(input, 6, context(false, fetcher as typeof fetch, async () => {}));
    expect(result.complete).toBe(false); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('stays within the request budget even under repeated 413s', async () => {
    const ctx = mockContext(() => new Response('', { status: 413 }));
    const result = await stockPage({ ...input, skus: FALLBACK_PRODUCTS.map(p => p.sku) }, 8, ctx);
    expect(ctx.remaining).toBeGreaterThanOrEqual(0); expect(vi.mocked(ctx.fetcher).mock.calls.length).toBeLessThanOrEqual(40); expect(result.complete).toBe(false);
  });
  it('reports inconsistent store pages as partial', async () => {
    let i = 0; const ctx = mockContext(body => Response.json(payload(++i, body.products)));
    expect((await stockPage({ ...input, skus: [sku, '100256811'] }, 1, ctx)).complete).toBe(false);
  });
});
describe('browser scan rules', () => {
  it('sorts available first, then nearest, with unknown distance last', () => {
    expect(sortStores([store('A', 100), store('B', 20), store('C', null)], [stock('available', 'A')]).map(s => s.code)).toEqual(['A', 'B', 'C']);
  });
  it('requires two ordered outside pages and disables early stop on disorder', () => {
    const guard = new RadiusGuard(); expect(guard.shouldStop([store('A', 60000)], 50)).toBe(false); expect(guard.shouldStop([store('B', 70000)], 50)).toBe(true);
    const disorder = new RadiusGuard(); disorder.shouldStop([store('A', 70000)], 50); expect(disorder.shouldStop([store('B', 60000)], 50)).toBe(false); expect(disorder.shouldStop([store('C', 90000)], 50)).toBe(false);
    expect(new RadiusGuard().shouldStop([store('A', null)], 50)).toBe(false); expect(new RadiusGuard().shouldStop([store('A', 100000)], 0)).toBe(false);
  });
  it('detects only observed transitions, preserving missing/unknown prior state', () => {
    const key = `A:${sku}`;
    expect(changes({}, [stock()])).toEqual({}); expect(changes({ [key]: 'unavailable' }, [stock()])).toEqual({ [key]: 'new' });
    expect(changes({ [key]: 'available' }, [stock('unavailable')])).toEqual({ [key]: 'gone' });
    expect(updateSnapshot({ [key]: 'available' }, [stock('unknown')])).toEqual({ [key]: 'available' });
    expect(updateSnapshot({ [key]: 'available' }, [])).toEqual({ [key]: 'available' });
  });
  it('store inventory matches exact code and leaves missing SKUs unknown', () => {
    const result = groupInventory(FALLBACK_PRODUCTS, [stock('available', 'OTHER')], 'A');
    expect(result).toHaveLength(40); expect(result.every(r => r.stock === undefined)).toBe(true);
  });
  it('merges retry stock without duplicates or discarded earlier results', async () => {
    const p = await stockPage(input, 6, mockContext(() => Response.json(payload(1))));
    expect(mergePages(p, p).stock).toHaveLength(1); expect(mergePages(p, p).stores).toHaveLength(1);
  });
  it('uses local store day and opening hours', () => {
    expect(hoursToday({ ...store(), hours: { wed: '09:30 AM - 05:30 PM' } }, new Date('2026-09-16T01:00:00Z'))).toBe('Open · closes 5:30 PM');
    expect(hoursToday({ ...store(), hours: { wed: 'Closed' } }, new Date('2026-09-16T01:00:00Z'))).toBe('Closed today');
  });
});
describe('metadata and coalescing', () => {
  it('parses entity-encoded duplicate variant attributes and skips malformed nodes', () => {
    const node = `<div data-mobile-variant='${JSON.stringify({ sku, colour: 'Silver', storage: '512GB' }).replaceAll('"', '&quot;')}'></div>`;
    expect(parseProducts(node + node + `<div data-mobile-variant='broken'></div>`, 'iPhone 18 Pro Max')).toHaveLength(1);
  });
  it('pulls Telstra image URLs from variant fields and page metadata', () => {
    const variant = JSON.stringify({ sku, colour: 'Silver', storage: '512GB', images: [{ src: '/content/iphone-silver.webp' }] }).replaceAll('"', '&quot;');
    const parsed = parseProducts(`<meta property="og:image" content="/content/iphone-max.webp"><div data-mobile-variant='${variant}'></div>`, 'iPhone 18 Pro Max', 'https://www.telstra.com.au/mobile-phones/mobiles-on-a-plan/apple/iphone-18-pro-max');
    expect(parsed[0].imageUrl).toBe('https://www.telstra.com.au/content/iphone-silver.webp');
    expect(parseProducts(`<meta property="og:image" content="/content/iphone-max.webp"><div data-mobile-variant='${JSON.stringify({ sku, colour: 'Silver', storage: '512GB' })}'></div>`, 'iPhone 18 Pro Max', 'https://www.telstra.com.au/mobile-phones/mobiles-on-a-plan/apple/iphone-18-pro-max')[0].imageUrl).toBe('https://www.telstra.com.au/content/iphone-max.webp');
    expect(parseProducts(`<div data-mobile-variant='${JSON.stringify({ sku, colour: 'Silver', storage: '512GB', imageUrl: 'http://insecure.example/device.jpg' })}'></div>`, 'iPhone 18 Pro Max')[0].imageUrl).toBeUndefined();
    expect(parseProducts('<img alt="iPhone 18 Pro Max" src="/images/iphone-18-pro-max.webp">' + `<div data-mobile-variant='${JSON.stringify({ sku, colour: 'Silver', storage: '512GB' })}'></div>`, 'iPhone 18 Pro Max', 'https://www.telstra.com.au/mobile-phones/iphone-18-pro-max')[0].imageUrl).toBe('https://www.telstra.com.au/images/iphone-18-pro-max.webp');
  });
  it('collects every distinct photo for a variant into images, not just the hero shot', () => {
    const gallery = JSON.stringify({ sku, colour: 'Silver', storage: '512GB', images: [{ src: '/a.webp' }, '/b.webp', { src: '/a.webp' }, { url: '/c.webp' }] }).replaceAll('"', '&quot;');
    const parsed = parseProducts(`<div data-mobile-variant='${gallery}'></div>`, 'iPhone 18 Pro Max', 'https://www.telstra.com.au/mobile-phones/mobiles-on-a-plan/apple/iphone-18-pro-max');
    expect(parsed[0].images).toEqual(['https://www.telstra.com.au/a.webp', 'https://www.telstra.com.au/b.webp', 'https://www.telstra.com.au/c.webp']);
    expect(parsed[0].imageUrl).toBe(parsed[0].images![0]);
  });
  it('keeps all fallback variants when discovery fails', async () => {
    const result = await getProducts(async () => new Response('', { status: 404 }));
    expect(result.variants).toHaveLength(40); expect(result.fallbackActive).toBe(true); expect(result.discoveredCount).toBe(0);
  });
  it('follows product-page redirects before parsing Telstra metadata', async () => {
    const result = await getProducts(async (_url, init) => { expect(init?.redirect).toBe('follow'); return new Response('<meta content="https://images.telstra.com.au/iphone.webp" property="og:image">', { status: 200 }); });
    expect(result.variants.filter(p => p.imageUrl)).toHaveLength(40);
  });
  it('sends a non-empty User-Agent on product-page requests (Telstra 403s requests with none)', async () => {
    await getProducts(async (_url, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('User-Agent')).toBeTruthy();
      return new Response('', { status: 200 });
    });
  });
  it('applies a Telstra page image to fallback variants when variant JSON is absent', async () => {
    const result = await getProducts(async () => new Response('<img alt="iPhone device" src="https://images.telstra.com.au/iphone-device.webp">', { status: 200 }));
    expect(result.variants.filter(p => p.imageUrl)).toHaveLength(40);
  });
  it('coalesces identical work and releases failed requests', async () => {
    const loader = vi.fn(async () => ({ ok: true }));
    await Promise.all([cached('same', 20, loader), cached('same', 20, loader)]); expect(loader).toHaveBeenCalledTimes(1);
    await expect(cached('failure', 20, async () => { throw new Error('fail'); })).rejects.toThrow();
    expect(await cached('failure', 20, async () => 'recovered')).toBe('recovered');
  });
});
