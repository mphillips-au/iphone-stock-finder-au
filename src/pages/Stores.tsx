import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import type { DirectoryStore, Location } from '../shared/types';
import { StoreActions } from '../components/StoreRow';
import { distance } from '../shared/scan';
import { WEEK_DAYS, hoursToday } from '../shared/hours';
const StoreMap = lazy(() => import('../components/StoreMap'));
const STATES = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'];
const PAGE_SIZE = 5;
const isOpenNow = (store: DirectoryStore) => hoursToday(store).startsWith('Open ·');
const ICONS = {
  store: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9.5 5 4h14l1 5.5"/><path d="M4 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0"/><path d="M5 9.8V20h14V9.8"/><path d="M10 20v-5h4v5"/></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.35-4.35"/></svg>,
  pin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s7-7.4 7-12.5A7 7 0 0 0 5 9.5C5 14.6 12 22 12 22Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>,
  crosshair: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9" strokeDasharray="2 3"/></svg>,
  phone: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2" strokeLinecap="round"/></svg>,
  box: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 7.5 12 3l8.5 4.5V16L12 20.5 3.5 16Z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v8.5"/></svg>,
  clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>,
};
function pageList(current: number, total: number): (number | '…')[] {
  const set = new Set([0, total - 1, current - 1, current, current + 1].filter(p => p >= 0 && p < total));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((p, i) => { if (i > 0 && p - sorted[i - 1] > 1) out.push('…'); out.push(p); });
  return out;
}
export default function Stores({ stores, favourites, toggleFavourite, onOpen, location }: { stores: DirectoryStore[]; favourites: string[]; toggleFavourite: (code: string) => void; onOpen: (store: DirectoryStore) => void; location: Location }) {
  const [query, setQuery] = useState(''), [state, setState] = useState(''), [openNow, setOpenNow] = useState(false), [hasStock, setHasStock] = useState(false);
  const [page, setPage] = useState(0), [selectedCode, setSelectedCode] = useState<string>();
  const [origin, setOrigin] = useState(location), [locating, setLocating] = useState(false);
  useEffect(() => { setPage(0); }, [query, state, openNow, hasStock]);
  const totalCount = stores.length, openCount = stores.filter(isOpenNow).length, stockCount = stores.filter(s => s.variantsInStock > 0).length;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stores.map(s => ({ ...s, distanceMetres: distance(origin, s) }))
      .filter(s => (!q || `${s.name} ${s.suburb} ${s.postcode} ${s.address}`.toLowerCase().includes(q)) && (!state || s.state === state) && (!openNow || isOpenNow(s)) && (!hasStock || s.variantsInStock > 0))
      .sort((a, b) => (a.distanceMetres ?? Infinity) - (b.distanceMetres ?? Infinity));
  }, [stores, origin, query, state, openNow, hasStock]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStores = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const selected = pageStores.find(s => s.code === selectedCode) ?? pageStores[0];
  const mapStock = filtered.filter(s => s.variantsInStock > 0).map(s => ({ storeCode: s.code, sku: '', status: 'available', usageType: '' }));
  function locate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(p => { setOrigin({ label: 'Your location', lat: p.coords.latitude, lon: p.coords.longitude }); setLocating(false); }, () => setLocating(false), { timeout: 10000 });
  }
  return <section>
    <div className="page-heading stores-heading">
      <div><span className="eyebrow">TELSTRA STORE DIRECTORY</span><h1>Find a Telstra store near you.</h1><p className="muted">Browse every Telstra store we track, check opening hours and see live iPhone stock.</p></div>
      <div className="stat-cards">
        <div className="stat-card"><span className="stat-icon">{ICONS.store}</span><div><strong>{totalCount}</strong><span>Telstra stores</span></div></div>
        <div className="stat-card"><span className="stat-icon stat-dot" aria-hidden="true"><span className="dot"/></span><div><strong>{openCount}</strong><span>Open now</span></div></div>
        <div className="stat-card"><span className="stat-icon">{ICONS.phone}</span><div><strong>{stockCount}</strong><span>With iPhone stock</span></div></div>
        <div className="stat-card"><span className="stat-icon">{ICONS.pin}</span><div><strong>All states</strong><span>Australia</span></div></div>
      </div>
    </div>
    <form className="stores-toolbar" onSubmit={e => e.preventDefault()}>
      <label className="stores-search"><span className="field-icon" aria-hidden="true">{ICONS.search}</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search suburb, postcode or store name…"/></label>
      <label className="stores-select">State<select value={state} onChange={e => setState(e.target.value)}><option value="">All states</option>{STATES.map(s => <option key={s}>{s}</option>)}</select></label>
      <label className="check"><input type="checkbox" checked={openNow} onChange={e => setOpenNow(e.target.checked)}/> Open now</label>
      <label className="check"><input type="checkbox" checked={hasStock} onChange={e => setHasStock(e.target.checked)}/> Has iPhone stock</label>
      <button type="button" className="button secondary" onClick={locate} disabled={locating}>{ICONS.crosshair} {locating ? 'Locating…' : 'Use my location'}</button>
    </form>
    {!filtered.length ? <div className="empty"><span className="empty-symbol" aria-hidden="true">⌖</span><div><h3>No matching stores</h3><p>Try a different suburb, postcode or store name, or clear the state filter.</p></div></div> : <>
      <div className="stores-list-head"><h2>{filtered.length} Telstra store{filtered.length === 1 ? '' : 's'}</h2><span className="muted">Showing {page * PAGE_SIZE + 1}–{Math.min(filtered.length, page * PAGE_SIZE + pageStores.length)} of {filtered.length} stores</span></div>
      <div className="stores-columns">
        <ul className="store-list">{pageStores.map(store => <li key={store.code}><button type="button" className={`store-list-row${selected?.code === store.code ? ' selected' : ''}`} onClick={() => setSelectedCode(store.code)}>
          <span className="store-thumb" aria-hidden="true">{ICONS.store}</span>
          <span className="store-list-info">
            <span className="store-list-head"><strong>{store.name}</strong><span className={`status-dot-label${isOpenNow(store) ? ' open' : ''}`}><span className="dot"/>{isOpenNow(store) ? 'Open' : 'Closed'}</span></span>
            <span className="muted">{store.address}, {store.suburb} {store.state} {store.postcode}</span>
            <span className="muted store-list-meta">{store.distanceMetres === null ? 'Distance unknown' : `${(store.distanceMetres / 1000).toFixed(1)} km`}</span>
            {store.variantsInStock > 0 && <span className="badge available">{store.variantsInStock} iPhone variant{store.variantsInStock === 1 ? '' : 's'}</span>}
          </span>
        </button></li>)}</ul>
        <div className="store-detail-panel">
          {selected ? <>
            <div className="detail-photo"><span className="detail-photo-icon" aria-hidden="true">{ICONS.store}</span></div>
            <div className="detail-head"><h2>{selected.name}</h2><button className="star" aria-label={`${favourites.includes(selected.code) ? 'Unsave' : 'Save'} ${selected.name}`} aria-pressed={favourites.includes(selected.code)} onClick={() => toggleFavourite(selected.code)}>{favourites.includes(selected.code) ? '★' : '☆'}</button></div>
            <p className="muted">{ICONS.pin} {selected.address}, {selected.suburb} {selected.state} {selected.postcode}</p>
            <p className="muted">{selected.distanceMetres === null ? 'Distance unknown' : `${(selected.distanceMetres / 1000).toFixed(1)} km from your search origin`}</p>
            <p className={`status-line${isOpenNow(selected) ? ' open' : ''}`}><span className="status-line-dot"/> {hoursToday(selected)}</p>
            {selected.variantsInStock > 0 && <span className="badge available">In stock ({selected.variantsInStock} variant{selected.variantsInStock === 1 ? '' : 's'})</span>}
            <StoreActions store={selected}/>
            <div className="detail-info">
              <h3>Trading hours</h3>
              <ul className="hours-list">{WEEK_DAYS.map(([key, label]) => <li key={key}><span>{label}</span><span>{selected.hours[key] || 'Closed'}</span></li>)}</ul>
            </div>
            <button type="button" className="text-button detail-more" onClick={() => onOpen(selected)}>View full iPhone inventory →</button>
          </> : <p className="muted">Select a store to see its details.</p>}
        </div>
        <div className="stores-map-pane">
          <Suspense fallback={<div className="store-map-card"/>}><StoreMap stores={filtered} stock={mapStock} center={origin} onSelect={s => setSelectedCode(s.code)} note={`Showing ${filtered.length} Telstra stores`}/></Suspense>
        </div>
      </div>
      <div className="pagination"><button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)} aria-label="Previous page">‹</button>{pageList(page, totalPages).map((p, i) => p === '…' ? <span key={`e${i}`} className="pagination-ellipsis">…</span> : <button type="button" key={p} className={p === page ? 'active' : ''} aria-current={p === page ? 'page' : undefined} onClick={() => setPage(p)}>{p + 1}</button>)}<button type="button" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} aria-label="Next page">›</button></div>
    </>}
    <div className="helpful-info">
      <div><span className="helpful-icon">{ICONS.box}</span><div><h3>Live stock</h3><p className="muted">Check iPhone availability at each store.</p></div></div>
      <div><span className="helpful-icon">{ICONS.clock}</span><div><h3>Opening hours</h3><p className="muted">View trading hours before you visit.</p></div></div>
      <div><span className="helpful-icon">{ICONS.phone}</span><div><h3>Need help?</h3><p className="muted">Call the store directly or contact Telstra support.</p></div></div>
    </div>
  </section>;
}
