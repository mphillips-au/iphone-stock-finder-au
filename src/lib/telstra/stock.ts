import type { PageInput, Stock, StockPage, Store } from '../../shared/types';
import { normaliseStock } from './normalise';
import { context, upstream, UpstreamError, type RequestContext } from './http';
export const STOCK_URL = 'https://prod.okapi.ogw.evolve.okapi.telstra.com/tcom-ext/v1/stock/check';
export async function stockPage(input: PageInput, batchSize = 6, ctx: RequestContext = context()): Promise<StockPage> {
  const stores = new Map<string, Store>(), stock = new Map<string, Stock>(), failedSkus: string[] = [];
  let pageLength: number | null = null, inconsistent = false;
  let pageCodes: string[] | null = null;
  async function batch(skus: string[]): Promise<void> {
    try {
      const raw = await upstream(STOCK_URL, { lat: String(input.lat), lon: String(input.lon), products: skus, from: input.from, size: 10 }, ctx);
      const result = normaliseStock(raw, skus), codes = result.stores.map(s => s.code).sort();
      if (ctx.debug) console.log(JSON.stringify({ event: 'Telstra page normalised', from: input.from, storeCount: result.stores.length, stockRecordCount: result.stock.length }));
      if (pageCodes && JSON.stringify(codes) !== JSON.stringify(pageCodes)) inconsistent = true;
      pageCodes ??= codes;
      pageLength = Math.max(pageLength ?? 0, result.stores.length);
      result.stores.forEach(s => stores.set(s.code, s));
      result.stock.forEach(s => stock.set(`${s.storeCode}:${s.sku}`, s));
    } catch (error) {
      if (ctx.debug) console.warn(JSON.stringify({ event: 'Telstra batch failed', status: error instanceof UpstreamError ? error.status : 0, reason: error instanceof Error ? error.message : 'Unknown error', from: input.from, skuCount: skus.length }));
      if (error instanceof UpstreamError && error.status === 413 && skus.length > 1 && ctx.remaining > 1) {
        const mid = Math.ceil(skus.length / 2);
        await batch(skus.slice(0, mid)); await batch(skus.slice(mid));
      } else failedSkus.push(...skus);
    }
  }
  const size = Math.max(1, Math.min(8, Math.floor(batchSize) || 6));
  for (let i = 0; i < input.skus.length; i += size) await batch(input.skus.slice(i, i + size));
  return {
    stores: [...stores.values()], stock: [...stock.values()], from: input.from,
    nextFrom: pageLength === null || pageLength >= 10 || inconsistent ? input.from + 10 : null,
    checkedAt: new Date().toISOString(), failedSkus, complete: failedSkus.length === 0 && !inconsistent,
    warning: inconsistent ? 'Store ordering changed during this page. Retry this page before continuing.' : failedSkus.length ? 'Telstra did not respond for some configurations. Successful results are preserved.' : undefined,
  };
}
