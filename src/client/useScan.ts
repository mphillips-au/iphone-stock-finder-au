import { useRef, useState } from 'react';
import type { Location, StockPage } from '../shared/types';
import { changes, mergePages, RadiusGuard, updateSnapshot, type Snapshot } from '../shared/scan';
import { fetchPage } from './api';
import { readLocal, writeLocal } from './storage';
export interface ScanQuery { location: Location; skus: string[]; radius: number; storeCode?: string }
interface Cursor { query: ScanQuery; from: number; skus: string[]; page?: StockPage; guard: RadiusGuard; baseline: Snapshot }
const empty: StockPage = { stores: [], stock: [], from: 0, nextFrom: 0, checkedAt: '', failedSkus: [], complete: false };
export function useScan(onPage?: (page: StockPage) => void) {
  const [result, setResult] = useState<StockPage>(empty), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [paused, setPaused] = useState(false);
  const [diff, setDiff] = useState<Record<string, 'new' | 'gone'>>({});
  const [query, setQuery] = useState<ScanQuery>();
  const controller = useRef<AbortController | null>(null), cursor = useRef<Cursor | null>(null), accumulated = useRef(empty);
  const pausedRef = useRef(false);
  async function run(next?: ScanQuery) {
    if (controller.current) return;
    const previous = readLocal<Snapshot>('snapshot', {}, value => typeof value === 'object' && !Array.isArray(value));
    if (next) {
      cursor.current = { query: next, from: 0, skus: next.skus, guard: new RadiusGuard(), baseline: previous };
      accumulated.current = empty; setResult(empty); setDiff({}); setQuery(next);
    }
    const c = cursor.current; if (!c) return;
    pausedRef.current = false; setPaused(false);
    const abort = new AbortController(); controller.current = abort; setBusy(true); setError('');
    try {
      for (let pages = 0; pages < 1001; pages++) {
        const p = await fetchPage({ lat: c.query.location.lat, lon: c.query.location.lon, from: c.from, size: 10, skus: c.skus }, abort.signal);
        const page = c.page ? mergePages(c.page, p) : p;
        accumulated.current = mergePages(accumulated.current, page);
        setResult({ ...accumulated.current, complete: false });
        const nextDiff = changes(c.baseline, accumulated.current.stock); setDiff(nextDiff);
        writeLocal('snapshot', updateSnapshot(readLocal<Snapshot>('snapshot', {}, v => typeof v === 'object' && !Array.isArray(v)), accumulated.current.stock));
        onPage?.(page);
        if (!p.complete) {
          c.page = page; c.skus = p.failedSkus.length ? p.failedSkus : c.query.skus;
          throw new Error(p.warning ?? 'Partial results. Retry the remaining configurations.');
        }
        const foundStore = c.query.storeCode && page.stores.some(s => s.code === c.query.storeCode);
        if (foundStore || p.nextFrom === null || (!c.query.storeCode && c.guard.shouldStop(page.stores, c.query.radius))) {
          if (c.query.storeCode && !foundStore) throw new Error('This store was not found in the current Telstra results. Try again later.');
          setResult({ ...accumulated.current, complete: true }); cursor.current = null; break;
        }
        c.from = p.nextFrom; c.page = undefined; c.skus = c.query.skus;
        if (c.from > 10000) throw new Error('The scan reached its safety limit. Results are partial.');
      }
    } catch (e) {
      setError(abort.signal.aborted ? pausedRef.current ? 'Scan paused while this tab was hidden. It will resume when you return.' : 'Scan stopped. Successful results are preserved.' : e instanceof Error ? e.message : 'Could not finish this scan.');
    } finally { controller.current = null; setBusy(false); }
  }
  function pause() {
    if (!cursor.current) return;
    pausedRef.current = true; setPaused(true); controller.current?.abort();
  }
  function resume() {
    if (!pausedRef.current || document.hidden || controller.current || !cursor.current) return;
    pausedRef.current = false; setPaused(false); void run();
  }
  function cancel() { pausedRef.current = false; setPaused(false); controller.current?.abort(); }
  return { result, busy, paused, error, diff, query, run, pause, resume, cancel, canResume: !!cursor.current };
}
