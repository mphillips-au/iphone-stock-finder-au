import { TRACKED_SKUS } from '../../data/products';
import type { Stock, Store } from '../../shared/types';
import { context, type RequestContext } from './http';
import { stockPage } from './stock';

// Distance-ordered store pagination is exhaustive: page deep enough from any single seed
// point and every Telstra store nationwide eventually appears (furthest last). The seed's
// own location only affects discovery order, never coverage, so one fixed seed is enough —
// no grid of regional points needed. Melbourne CBD is deliberate (not arbitrary like the old
// Sydney seed): the user wants Victoria indexed first.
const SEED = { lat: -37.8136, lon: 144.9631 };
// Larger than the live per-request batch (src/worker.ts) since the indexer has a whole
// cron budget to spend rather than one visitor's page load; 413 splitting still applies.
// Kept modest (not the previous 20) to keep each cron invocation's D1-upsert/parsing work
// small enough to stay under the Workers Free plan's CPU-time ceiling — see HANDOFF.md.
export const INDEXER_SKU_BATCH_SIZE = 10;
// Safety valve so one invocation can never spin forever even if `remaining` bookkeeping
// (see http.ts) somehow desyncs from actual request count. Deliberately small (not the
// previous 60): fewer store pages, and therefore fewer D1 upserts, per cron tick keeps CPU
// time per invocation low enough to avoid the exceededCpu kills seen in production, at the
// cost of more ticks to finish a full nationwide cycle.
const MAX_PAGES_PER_RUN = 6;
// Stop a cycle once this many consecutive pages return zero stores — Telstra's paging
// keeps returning empty pages past the end of its real store list, it never "runs out"
// with an error, so an empty streak is the only reliable end-of-list signal.
const EMPTY_PAGE_STREAK_TO_FINISH = 2;

interface SyncState { from: number; emptyStreak: number }
const STATE_KEY = 'stock_cursor';

async function readState(db: D1Database): Promise<SyncState> {
  const row = await db.prepare('SELECT value FROM sync_state WHERE key = ?').bind(STATE_KEY).first<{ value: string }>();
  if (!row) return { from: 0, emptyStreak: 0 };
  try {
    const parsed = JSON.parse(row.value) as Partial<SyncState>;
    return { from: Number.isInteger(parsed.from) && (parsed.from as number) >= 0 ? (parsed.from as number) : 0, emptyStreak: Number.isInteger(parsed.emptyStreak) ? (parsed.emptyStreak as number) : 0 };
  } catch { return { from: 0, emptyStreak: 0 }; }
}
async function writeState(db: D1Database, key: string, value: unknown): Promise<void> {
  await db.prepare('INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, JSON.stringify(value)).run();
}
async function upsertStores(db: D1Database, stores: Store[], updatedAt: string): Promise<void> {
  for (const s of stores) {
    await db.prepare(
      `INSERT INTO stores (code, name, address, suburb, postcode, state, phone, latitude, longitude, hours, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(code) DO UPDATE SET name=excluded.name, address=excluded.address, suburb=excluded.suburb, postcode=excluded.postcode, state=excluded.state, phone=excluded.phone, latitude=excluded.latitude, longitude=excluded.longitude, hours=excluded.hours, updated_at=excluded.updated_at`,
    ).bind(s.code, s.name, s.address, s.suburb, s.postcode, s.state, s.phone ?? null, s.latitude, s.longitude, JSON.stringify(s.hours), updatedAt).run();
  }
}
async function upsertStock(db: D1Database, stock: Stock[], updatedAt: string): Promise<void> {
  for (const s of stock) {
    await db.prepare(
      `INSERT INTO stock (store_code, sku, status, usage_type, updated_at) VALUES (?,?,?,?,?)
       ON CONFLICT(store_code, sku) DO UPDATE SET status=excluded.status, usage_type=excluded.usage_type, updated_at=excluded.updated_at`,
    ).bind(s.storeCode, s.sku, s.status, s.usageType, updatedAt).run();
  }
}

export interface IndexResult { pagesProcessed: number; storesUpserted: number; stockUpserted: number; cycleComplete: boolean; nextFrom: number }

/** Runs one staggered slice of a nationwide indexing cycle, bounded by the shared upstream request budget in `ctx`. */
export async function runIndexCycle(db: D1Database, ctx: RequestContext = context(false)): Promise<IndexResult> {
  const state = await readState(db);
  let from = state.from, emptyStreak = state.emptyStreak;
  let storesUpserted = 0, stockUpserted = 0, pagesProcessed = 0, cycleComplete = false;
  const updatedAt = new Date().toISOString();
  // Leave enough budget for one more full page (a SKU-batch split can add extra requests)
  // before stopping, rather than starting a page we can't finish.
  while (ctx.remaining > 4 && pagesProcessed < MAX_PAGES_PER_RUN) {
    const page = await stockPage({ lat: SEED.lat, lon: SEED.lon, from, size: 10, skus: TRACKED_SKUS }, INDEXER_SKU_BATCH_SIZE, ctx, INDEXER_SKU_BATCH_SIZE);
    pagesProcessed++;
    if (page.stores.length === 0) {
      emptyStreak++;
      if (emptyStreak >= EMPTY_PAGE_STREAK_TO_FINISH) { cycleComplete = true; break; }
    } else {
      emptyStreak = 0;
      await upsertStores(db, page.stores, updatedAt); storesUpserted += page.stores.length;
      await upsertStock(db, page.stock, updatedAt); stockUpserted += page.stock.length;
    }
    from += 10;
    if (from > 10000) { cycleComplete = true; break; }
  }
  await writeState(db, STATE_KEY, cycleComplete ? { from: 0, emptyStreak: 0 } : { from, emptyStreak });
  if (cycleComplete) await writeState(db, 'last_full_cycle_at', updatedAt);
  return { pagesProcessed, storesUpserted, stockUpserted, cycleComplete, nextFrom: cycleComplete ? 0 : from };
}

export async function readLastFullCycleAt(db: D1Database): Promise<string | null> {
  const row = await db.prepare('SELECT value FROM sync_state WHERE key = ?').bind('last_full_cycle_at').first<{ value: string }>();
  if (!row) return null;
  try { return JSON.parse(row.value) as string; } catch { return null; }
}
