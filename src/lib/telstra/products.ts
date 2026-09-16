import { FALLBACK_PRODUCTS, PRODUCT_PAGES } from '../../data/products';
import type { Catalogue, Model, ProductVariant } from '../../shared/types';
import { array, object, string } from './normalise';
export function decodeEntities(value: string): string {
  return value.replace(/&(?:quot|apos|amp|lt|gt|#\d+|#x[\da-f]+);/gi, entity => {
    const named: Record<string, string> = { '&quot;': '"', '&apos;': "'", '&amp;': '&', '&lt;': '<', '&gt;': '>' };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const hex = entity.toLowerCase().startsWith('&#x'), n = parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
  });
}
function resolveImageUrl(value: unknown, baseUrl?: string): string | undefined {
  const raw = string(value).trim().replace(/\\u002F/gi, '/');
  if (!raw || raw.startsWith('data:') || raw.startsWith('javascript:')) return undefined;
  try {
    const url = new URL(raw, baseUrl);
    return url.protocol === 'https:' ? url.href : undefined;
  } catch { return undefined; }
}
function firstImage(value: unknown, baseUrl?: string): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) { const result = firstImage(item, baseUrl); if (result) return result; }
    return undefined;
  }
  if (typeof value === 'string') return resolveImageUrl(value, baseUrl);
  const v = object(value);
  return resolveImageUrl(v.url ?? v.src ?? v.href ?? v.uri ?? v.imageUrl ?? v.image, baseUrl);
}
function pageImage(html: string, baseUrl?: string): string | undefined {
  const candidates = [
    ...[...html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi)].map(m => m[1]),
    ...[...html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/gi)].map(m => m[1]),
    ...[...html.matchAll(/<link[^>]+rel=["'][^"']*image_src[^"']*["'][^>]+href=["']([^"']+)["']/gi)].map(m => m[1]),
    ...[...html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*image_src[^"']*["']/gi)].map(m => m[1]),
    ...[...html.matchAll(/<img\b[^>]*(?:src|data-src|data-lazy-src)=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]),
    ...[...html.matchAll(/<img\b[^>]*(?:srcset|data-srcset)=["']([^"']+)["'][^>]*>/gi)].flatMap(m => m[1].split(',').map(value => value.trim().split(/\s+/)[0])),
  ];
  const resolved = candidates.map(candidate => resolveImageUrl(candidate, baseUrl)).filter((value): value is string => Boolean(value));
  return resolved.find(value => /iphone|apple|device|mobile/i.test(value)) ?? resolved[0];
}
export function parseProducts(html: string, model: Model, baseUrl?: string): ProductVariant[] {
  const found = new Map<string, ProductVariant>();
  const fallbackImage = pageImage(html, baseUrl);
  for (const match of html.matchAll(/\bdata-mobile-variant\s*=\s*(['"])([\s\S]*?)\1/gi)) {
    try {
      const parsed: unknown = JSON.parse(decodeEntities(match[2]));
      for (const raw of Array.isArray(parsed) ? parsed : [parsed]) {
        const v = object(raw), sku = string(v.sku);
        if (!/^\d{9}$/.test(sku) || !string(v.colour) || !string(v.storage)) continue;
        const fallback = FALLBACK_PRODUCTS.find(p => p.sku === sku) ?? FALLBACK_PRODUCTS.find(p => p.model === model)!;
        const candidate = firstImage(v.images ?? v.image ?? v.imageUrl, baseUrl) ?? fallbackImage;
        found.set(sku, { ...fallback, model, sku, colour: string(v.colour), storage: string(v.storage), deviceName: string(v.deviceName) || model,
          merchandisingStatus: string(v.merchandisingStatus), merchandisingMessage: string(v.merchandisingMessage),
          imageUrl: candidate, source: 'discovered' });
      }
    } catch { /* One malformed node must not disable the catalogue. */ }
  }
  return [...found.values()];
}
export async function getProducts(fetcher: typeof fetch = fetch, debug = false): Promise<Catalogue> {
  const variants = new Map(FALLBACK_PRODUCTS.map(p => [p.sku, p]));
  let discoveredCount = 0;
  for (const [model, url] of Object.entries(PRODUCT_PAGES)) {
    try {
      const response = await fetcher(url, { signal: AbortSignal.timeout(8000), redirect: 'follow' });
      if (!response.ok) { if (debug) console.warn(JSON.stringify({ event: 'Telstra product page failed', model, status: response.status })); await response.body?.cancel(); continue; }
      const html = await response.text();
      const discovered = parseProducts(html, model as Model, url);
      for (const p of discovered) { variants.set(p.sku, p); discoveredCount++; }
      const image = discovered.find(p => p.imageUrl)?.imageUrl ?? pageImage(html, url);
      if (image) for (const product of FALLBACK_PRODUCTS.filter(p => p.model === model && !p.imageUrl)) variants.set(product.sku, { ...product, imageUrl: image });
    } catch (error) { if (debug) console.warn(JSON.stringify({ event: 'Telstra product discovery failed', model, reason: error instanceof Error ? error.message : 'Unknown error' })); }
  }
  return { variants: [...variants.values()], updatedAt: new Date().toISOString(), discoveredCount, fallbackActive: [...variants.values()].some(p => p.source === 'fallback') };
}
