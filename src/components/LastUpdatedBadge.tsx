import type { SyncStatus } from '../shared/types';
function relative(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'under a minute ago';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
}
/** Honest staleness signal for the background snapshot: uses the *oldest* refreshed store, not the newest, so the badge never overstates how current the data is. */
export default function LastUpdatedBadge({ status }: { status: SyncStatus }) {
  if (!status.indexed || !status.oldestUpdate) return <span className="sync-badge sync-badge-pending"><span className="sync-dot" aria-hidden="true"/>Live indexing starting…</span>;
  const minutes = Math.max(0, Math.round((Date.now() - new Date(status.oldestUpdate).getTime()) / 60000));
  const fresh = minutes < 20;
  return <span className={`sync-badge${fresh ? ' sync-badge-fresh' : ''}`} title={`${status.storeCount} stores tracked nationwide · every configuration refreshed ${relative(status.oldestUpdate)}`}>
    <span className="sync-dot" aria-hidden="true"/>All {status.storeCount} stores updated {relative(status.oldestUpdate)}
  </span>;
}
