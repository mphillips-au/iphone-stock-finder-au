import { distance } from '../../shared/scan';
import type { PageInput, Stock, StockPage, Store, SyncStatus } from '../../shared/types';
import { readLastFullCycleAt } from './indexer';

interface StoreRow { code: string; name: string; address: string; suburb: string; postcode: string; state: string; phone: string | null; latitude: number | null; longitude: number | null; hours: string; updated_at: string }
interface StockRow { store_code: string; sku: string; status: string; usage_type: string; updated_at: string }

function toStore(row: StoreRow): Store {
  let hours: Record<string, string> = {};
  try { hours = JSON.parse(row.hours) as Record<string, string>; } catch { /* keep empty on corrupt row */ }
  return { code: row.code, name: row.name, address: row.address, suburb: row.suburb, postcode: row.postcode, state: row.state, phone: row.phone ?? undefined, latitude: row.latitude, longitude: row.longitude, distanceMetres: null, hours };
}

/** Reads one page of the nationwide snapshot, nearest-first from `input`. Returns null when the indexer hasn't populated any stores yet, so the caller can fall back to a live Telstra lookup. */
export async function snapshotPage(db: D1Database, input: PageInput): Promise<StockPage | null> {
  const { results } = await db.prepare('SELECT * FROM stores').all<StoreRow>();
  if (results.length === 0) return null;
  const withDistance = results.map(toStore).map(s => ({ store: s, distanceMetres: distance({ label: '', lat: input.lat, lon: input.lon }, s) }))
    .map(({ store, distanceMetres }) => ({ ...store, distanceMetres }))
    .sort((a, b) => (a.distanceMetres ?? Infinity) - (b.distanceMetres ?? Infinity));
  const page = withDistance.slice(input.from, input.from + input.size);
  const checkedAt = new Date().toISOString();
  if (page.length === 0) return { stores: [], stock: [], from: input.from, nextFrom: null, checkedAt, failedSkus: [], complete: true, snapshotAt: await readLastFullCycleAt(db) ?? undefined };
  const codes = page.map(s => s.code);
  const storePlaceholders = codes.map(() => '?').join(',');
  const skuPlaceholders = input.skus.map(() => '?').join(',');
  const stockRows = await db.prepare(`SELECT * FROM stock WHERE store_code IN (${storePlaceholders}) AND sku IN (${skuPlaceholders})`).bind(...codes, ...input.skus).all<StockRow>();
  const stock: Stock[] = stockRows.results.map(r => ({ storeCode: r.store_code, sku: r.sku, status: r.status, usageType: r.usage_type }));
  const timestamps = stockRows.results.map(r => r.updated_at).sort();
  const snapshotAt = timestamps.length ? timestamps[0] : await readLastFullCycleAt(db) ?? undefined;
  return { stores: page, stock, from: input.from, nextFrom: page.length < input.size ? null : input.from + input.size, checkedAt, failedSkus: [], complete: true, snapshotAt };
}

export interface DirectoryStore extends Store { variantsInStock: number }

/** Every store the indexer has ever recorded, with how many tracked SKUs are currently available at each — the dataset behind the Stores directory page. Distance is left null; callers compute it relative to their own search origin. */
export async function directoryStores(db: D1Database): Promise<DirectoryStore[]> {
  const [storesResult, stockResult] = await Promise.all([
    db.prepare('SELECT * FROM stores').all<StoreRow>(),
    db.prepare("SELECT store_code, status FROM stock WHERE status = 'available'").all<{ store_code: string; status: string }>(),
  ]);
  const counts = new Map<string, number>();
  for (const row of stockResult.results) counts.set(row.store_code, (counts.get(row.store_code) ?? 0) + 1);
  return storesResult.results.map(row => ({ ...toStore(row), variantsInStock: counts.get(row.code) ?? 0 }));
}

export async function readStatus(db: D1Database): Promise<SyncStatus> {
  const row = await db.prepare('SELECT COUNT(*) as count, MIN(updated_at) as oldest, MAX(updated_at) as latest FROM stores').first<{ count: number; oldest: string | null; latest: string | null }>();
  return { indexed: (row?.count ?? 0) > 0, storeCount: row?.count ?? 0, lastFullCycleAt: await readLastFullCycleAt(db), oldestUpdate: row?.oldest ?? null, latestUpdate: row?.latest ?? null };
}
