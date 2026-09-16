import type { Filters, Location, ProductVariant, Stock, StockPage, Store } from './types';
export const stockKey = (s: Stock) => `${s.storeCode}:${s.sku}`;
export const available = (s: Stock | undefined) => s?.status === 'available';
export function matchingProducts(products: ProductVariant[], filters: Filters): ProductVariant[] {
  return products.filter(p => (!filters.model || p.model === filters.model) && (!filters.storage || p.storage === filters.storage) && (!filters.colour || p.colour === filters.colour));
}
export function distance(a: Location, s: Store): number | null {
  if (s.latitude === null || s.longitude === null) return null;
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(s.latitude - a.lat), dLon = rad(s.longitude - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(s.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function sortStores(stores: Store[], stock: Stock[]): Store[] {
  const stocked = new Set(stock.filter(available).map(s => s.storeCode));
  return [...stores].sort((a, b) => Number(stocked.has(b.code)) - Number(stocked.has(a.code)) || (a.distanceMetres ?? Infinity) - (b.distanceMetres ?? Infinity));
}
// Require two entirely out-of-radius pages and monotonic distances across all seen pages.
// Once upstream ordering breaks, early stopping is disabled for the rest of this scan.
export class RadiusGuard {
  private last = -Infinity;
  private ordered = true;
  private outsidePages = 0;
  shouldStop(stores: Store[], radiusKm: number): boolean {
    if (!radiusKm || stores.length === 0) return false;
    for (const s of stores) {
      if (s.distanceMetres === null || s.distanceMetres < this.last) this.ordered = false;
      this.last = s.distanceMetres ?? this.last;
    }
    this.outsidePages = stores.every(s => s.distanceMetres !== null && s.distanceMetres > radiusKm * 1000) ? this.outsidePages + 1 : 0;
    return this.ordered && this.outsidePages >= 2;
  }
}
export type Snapshot = Record<string, string>;
export function changes(previous: Snapshot, current: Stock[]): Record<string, 'new' | 'gone'> {
  const result: Record<string, 'new' | 'gone'> = {};
  for (const s of current) {
    const before = previous[stockKey(s)];
    if (before === 'unavailable' && available(s)) result[stockKey(s)] = 'new';
    if (before === 'available' && s.status === 'unavailable') result[stockKey(s)] = 'gone';
  }
  return result;
}
export function updateSnapshot(previous: Snapshot, stock: Stock[]): Snapshot {
  const next = { ...previous };
  for (const s of stock) if (s.status === 'available' || s.status === 'unavailable') next[stockKey(s)] = s.status;
  return next;
}
export function mergePages(a: StockPage, b: StockPage): StockPage {
  return { ...b, stores: [...new Map([...a.stores, ...b.stores].map(s => [s.code, s])).values()], stock: [...new Map([...a.stock, ...b.stock].map(s => [stockKey(s), s])).values()] };
}
export function groupInventory(products: ProductVariant[], stock: Stock[], code: string) {
  const records = new Map(stock.filter(s => s.storeCode === code).map(s => [s.sku, s]));
  return products.map(product => ({ product, stock: records.get(product.sku) }));
}
