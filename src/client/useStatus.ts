import { useEffect, useState } from 'react';
import type { SyncStatus } from '../shared/types';
import { fetchStatus } from './api';
const EMPTY: SyncStatus = { indexed: false, storeCount: 0, lastFullCycleAt: null, oldestUpdate: null, latestUpdate: null };
/** Polls the tiny /api/status endpoint (not Telstra) so the "last updated" badge stays honest without any per-visitor upstream cost. Paused while the tab is hidden. */
export function useStatus() {
  const [status, setStatus] = useState<SyncStatus>(EMPTY);
  useEffect(() => {
    let cancelled = false;
    const load = () => { void fetchStatus().then(s => { if (!cancelled) setStatus(s); }).catch(() => {}); };
    load();
    const timer = window.setInterval(() => { if (!document.hidden) load(); }, 60000);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  return status;
}
