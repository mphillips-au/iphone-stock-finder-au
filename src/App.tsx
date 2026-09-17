import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { COLOUR_SWATCHES, FALLBACK_PRODUCTS, MODELS, STORAGE_ORDER } from './data/products';
import { DEFAULT_FILTERS, DEFAULT_LOCATION, type Catalogue, type DirectoryStore, type Filters, type Location, type StockPage, type Store } from './shared/types';
import { available, distance, matchingProducts, sortStores, stockKey } from './shared/scan';
import { readLocal, writeLocal } from './client/storage';
import { api, fetchStores } from './client/api';
import { useScan } from './client/useScan';
import { useStatus } from './client/useStatus';
import LocationInput from './components/LocationInput';
import StoreRow from './components/StoreRow';
import LastUpdatedBadge from './components/LastUpdatedBadge';
const Inventory = lazy(() => import('./pages/Inventory'));
const Products = lazy(() => import('./pages/Products'));
const Stores = lazy(() => import('./pages/Stores'));
const StoreMap = lazy(() => import('./components/StoreMap'));
const states = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'];
const ICON = {
  sun: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.6M12 18.9v2.6M4.6 4.6l1.9 1.9M17.5 17.5l1.9 1.9M2.5 12h2.6M18.9 12h2.6M4.6 19.4l1.9-1.9M17.5 6.5l1.9-1.9"/></svg>,
  moon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/></svg>,
  phone: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2" strokeLinecap="round"/></svg>,
  radius: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9" strokeDasharray="2 3"/></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.35-4.35"/></svg>,
  bell: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 16v-5a6 6 0 1 0-12 0v5l-1.5 2.5h15L18 16Z"/><path d="M9.5 21a2.5 2.5 0 0 0 5 0"/></svg>,
  play: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>,
  info: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5" strokeLinecap="round"/><circle cx="12" cy="8" r="0.6" fill="currentColor"/></svg>,
};
const validLocation = (v: unknown) => !!v && typeof v === 'object' && typeof (v as Location).label === 'string' && Number.isFinite((v as Location).lat) && Number.isFinite((v as Location).lon);
const isStringArray = (v: unknown) => Array.isArray(v) && v.every(x => typeof x === 'string');
const validFilters = (v: unknown) => !!v && typeof v === 'object' && typeof (v as Record<string, unknown>).model === 'string' && typeof (v as Record<string, unknown>).state === 'string' && isStringArray((v as Record<string, unknown>).storage) && isStringArray((v as Record<string, unknown>).colour) && typeof (v as Filters).radius === 'number' && typeof (v as Filters).availableOnly === 'boolean';
type Target = { id: string; filters: Filters; location: Location };
export default function App() {
  const [page, setPage] = useState('find'), [selectedStore, setSelectedStore] = useState<Store>();
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => readLocal('theme', 'system', v => v === 'light' || v === 'dark' || v === 'system'));
  const [location, setLocation] = useState(() => readLocal('location', DEFAULT_LOCATION, validLocation));
  const [locationValid, setLocationValid] = useState(true);
  const [filters, setFilters] = useState(() => readLocal('filters', DEFAULT_FILTERS, validFilters));
  const [catalogue, setCatalogue] = useState<Catalogue>({ variants: FALLBACK_PRODUCTS, updatedAt: '', fallbackActive: true, discoveredCount: 0 });
  const [directory, setDirectory] = useState<Store[]>(() => readLocal('stores', [], v => Array.isArray(v) && v.every(s => s && typeof s.code === 'string' && typeof s.name === 'string' && s.hours && typeof s.hours === 'object')));
  const [storeDirectory, setStoreDirectory] = useState<DirectoryStore[]>([]);
  const [favourites, setFavourites] = useState<string[]>(() => readLocal('favourites', [], v => Array.isArray(v) && v.every(s => typeof s === 'string')));
  const [targets, setTargets] = useState<Target[]>(() => readLocal('targets', [], v => Array.isArray(v) && v.every(t => t && typeof t.id === 'string' && validLocation(t.location) && validFilters(t.filters))));
  const [interval, setRefreshInterval] = useState(0), [notify, setNotify] = useState(() => readLocal('notify', false, v => typeof v === 'boolean'));
  const [sound, setSound] = useState(() => readLocal('sound', false, v => typeof v === 'boolean'));
  const audioContext = useRef<AudioContext | undefined>(undefined);
  const [changedOnly, setChangedOnly] = useState(false), [notice, setNotice] = useState('');
  const notified = useRef(new Set<string>());
  const chimed = useRef(new Set<string>());
  function remember(p: StockPage) { setDirectory(previous => { const merged = [...new Map([...previous, ...p.stores].map(s => [s.code, s])).values()]; writeLocal('stores', merged); return merged; }); }
  const scan = useScan(remember);
  const syncStatus = useStatus();
  useEffect(() => { const abort = new AbortController(); void api<Catalogue>('/api/products', abort.signal).then(setCatalogue).catch(() => {}); return () => abort.abort(); }, []);
  useEffect(() => { const abort = new AbortController(); void fetchStores(abort.signal).then(setStoreDirectory).catch(() => {}); return () => abort.abort(); }, []);
  useEffect(() => { writeLocal('location', location); writeLocal('filters', filters); }, [location, filters]);
  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  const effectiveDark = theme === 'dark' || (theme === 'system' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const onVisibility = () => { if (document.hidden) scan.pause(); else scan.resume(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  useEffect(() => {
    if (!interval || page !== 'find' || selectedStore) return;
    const timer = window.setInterval(() => { if (!document.hidden && !scan.busy && locationValid && scan.result.complete) check(); }, interval * 1000);
    return () => window.clearInterval(timer);
  }, [interval, scan.busy, scan.result.complete, filters, location, locationValid, page, selectedStore]);
  useEffect(() => {
    if (!notify || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    for (const [key, change] of Object.entries(scan.diff)) {
      if (change !== 'new' || notified.current.has(key)) continue;
      const record = scan.result.stock.find(s => stockKey(s) === key), product = catalogue.variants.find(p => p.sku === record?.sku), store = scan.result.stores.find(s => s.code === record?.storeCode);
      if (record && product && store) { try { new Notification('New iPhone stock', { body: `${product.model} · ${product.storage} ${product.colour}\n${store.name}`, tag: key }); notified.current.add(key); } catch { setNotice('Notifications are unavailable in this browser. New stock is still highlighted here.'); } }
    }
  }, [scan.diff, scan.result, notify, catalogue]);
  useEffect(() => {
    if (!sound) return;
    const newKeys = Object.keys(scan.diff).filter(k => scan.diff[k] === 'new' && !chimed.current.has(k));
    if (!newKeys.length) return;
    for (const key of newKeys) chimed.current.add(key);
    try {
      const ctx = audioContext.current ?? (audioContext.current = new AudioContext());
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.frequency.value = 880;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch { /* audio unavailable; visual highlighting still shows new stock */ }
  }, [scan.diff, sound]);
  function check(nextFilters = filters, nextLocation = location) {
    notified.current.clear();
    chimed.current.clear();
    const skus = matchingProducts(catalogue.variants, nextFilters).map(p => p.sku);
    if (skus.length) void scan.run({ location: nextLocation, skus, radius: nextFilters.radius });
  }
  function toggleStorage(value: string) { setFilters(f => ({ ...f, storage: f.storage.includes(value) ? f.storage.filter(x => x !== value) : [...f.storage, value] })); }
  function toggleColour(value: string) { setFilters(f => ({ ...f, colour: f.colour.includes(value) ? f.colour.filter(x => x !== value) : [...f.colour, value] })); }
  function toggleFavourite(code: string) { setFavourites(previous => { const next = previous.includes(code) ? previous.filter(c => c !== code) : [...previous, code]; writeLocal('favourites', next); return next; }); }
  function navigate(next: string) { scan.cancel(); setSelectedStore(undefined); setPage(next); }
  function openStore(store: Store) { scan.cancel(); setSelectedStore(store); window.scrollTo({ top: 0 }); }
  function saveTarget() { const next = [...targets, { id: crypto.randomUUID(), filters, location }].slice(-12); setTargets(next); writeLocal('targets', next); setNotice('Saved to My targets.'); }
  function startMonitoring() { if (!interval) setRefreshInterval(60); if (!notify) void notifications(true); }
  async function notifications(enabled: boolean) {
    if (!enabled) { setNotify(false); writeLocal('notify', false); return; }
    if (typeof Notification === 'undefined') { setNotice('Notifications are not supported by this browser.'); return; }
    try { const granted = await Notification.requestPermission() === 'granted'; setNotify(granted); writeLocal('notify', granted); if (!granted) setNotice('Notifications are blocked. You can enable them in your browser settings.'); } catch { setNotice('Could not enable notifications in this browser.'); }
  }
  const products = matchingProducts(catalogue.variants, filters), skus = new Set(products.map(p => p.sku));
  const stock = scan.result.stock.filter(s => skus.has(s.sku));
  const filteredStores = scan.result.stores.filter(s => (!filters.state || s.state === filters.state) && (!filters.radius || s.distanceMetres !== null && s.distanceMetres <= filters.radius * 1000));
  const rows = sortStores(filteredStores.filter(s => (!filters.availableOnly || stock.some(r => r.storeCode === s.code && available(r))) && (!changedOnly || stock.some(r => r.storeCode === s.code && scan.diff[stockKey(r)]))), stock);
  const availableStores = filteredStores.filter(s => stock.some(r => r.storeCode === s.code && available(r))).length;
  const needsScan = !!scan.query && (location.lat !== scan.query.location.lat || location.lon !== scan.query.location.lon || products.some(p => !scan.query!.skus.includes(p.sku)) || filters.radius !== scan.query.radius);
  const modelProducts = catalogue.variants.filter(p => !filters.model || p.model === filters.model);
  const heroPhoto = filters.model === 'iPhone Duo'
    ? { src: '/hero-iphone-duo.webp', width: 1100, height: 565, alt: 'iPhone Duo folded in Star White and Night Sky, and open showing its display', className: 'hero-phone-duo' }
    : { src: '/hero-iphone-18.webp', width: 1000, height: 855, alt: 'iPhone 18 Pro and iPhone 18 Pro Max in Black, Silver, Blue and Burgundy Titanium', className: 'hero-phone-photo' };
  const launch = modelProducts[0]?.marketLaunchDate;
  const days = launch ? Math.ceil((new Date(launch).getTime() - Date.now()) / 86400000) : 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!launch) return; const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, [launch]);
  const launchMs = launch ? new Date(launch).getTime() - now : 0;
  const countdown = launchMs > 0 ? { d: Math.floor(launchMs / 86400000), h: Math.floor(launchMs / 3600000) % 24, m: Math.floor(launchMs / 60000) % 60, s: Math.floor(launchMs / 1000) % 60 } : null;
  return <><header className="site-header"><a href="#" className="brand" onClick={e => { e.preventDefault(); navigate('find'); }}><img className="brand-logo" src={effectiveDark ? '/logo-dark.webp' : '/logo.webp'} width={577} height={240} alt="Stock Finder AU"/></a><nav aria-label="Main navigation">{[['find', 'Find stock'], ['stores', 'Stores'], ['products', 'Products']].map(([id, title]) => <button key={id} className={page === id && !selectedStore ? 'active' : ''} aria-current={page === id && !selectedStore ? 'page' : undefined} onClick={() => navigate(id)}>{title}</button>)}</nav><div className="header-right"><LastUpdatedBadge status={syncStatus}/><div className="theme-switch" role="group" aria-label="Theme"><button type="button" className={effectiveDark ? '' : 'active'} aria-pressed={!effectiveDark} aria-label="Light theme" onClick={() => { setTheme('light'); writeLocal('theme', 'light'); }}>{ICON.sun}</button><button type="button" className={effectiveDark ? 'active' : ''} aria-pressed={effectiveDark} aria-label="Dark theme" onClick={() => { setTheme('dark'); writeLocal('theme', 'dark'); }}>{ICON.moon}</button></div></div></header><main id="main"><Suspense fallback={<p className="empty" role="status">Loading…</p>}>
    {selectedStore ? <Inventory key={selectedStore.code} store={selectedStore} products={catalogue.variants} onBack={() => setSelectedStore(undefined)} onPage={remember}/> : page === 'products' ? <Products catalogue={catalogue} location={location} onCheck={next => { const merged = { ...filters, ...next }; setFilters(merged); navigate('find'); check(merged); }}/> : page === 'stores' ? <Stores stores={(storeDirectory.length ? storeDirectory : directory.map(s => ({ ...s, variantsInStock: 0 }))).map(s => ({ ...s, distanceMetres: distance(location, s) }))} favourites={favourites} toggleFavourite={toggleFavourite} onOpen={openStore} location={location}/> : <>
      <section className="hero"><div className="hero-copy"><div className="eyebrow">LIVE APPLE IPHONE STOCK</div><h1>Find your <em>iPhone.</em></h1><p>Check live stock at Telstra stores across Australia.</p></div><div className="hero-launch"><div className="hero-launch-info"><strong>{filters.model || 'The new iPhone lineup'}</strong><span>{days > 0 ? `Launches in ${days} ${days === 1 ? 'day' : 'days'}` : 'Check local availability'}</span></div>{countdown && <div className="countdown">{[[countdown.d, 'Days'], [countdown.h, 'Hours'], [countdown.m, 'Mins'], [countdown.s, 'Secs']].map(([n, label]) => <div key={label}><strong>{n}</strong><small>{label}</small></div>)}</div>}<img className={`hero-phone ${heroPhoto.className}`} src={heroPhoto.src} width={heroPhoto.width} height={heroPhoto.height} alt={heroPhoto.alt}/></div></section>
      <form className="search-surface" onSubmit={e => { e.preventDefault(); if (locationValid) check(); }}><div className="search-row"><LocationInput value={location} onChange={setLocation} onValid={setLocationValid} disabled={scan.busy}/><label className="search-field">iPhone model<div className="select-wrap"><span className="field-icon" aria-hidden="true">{ICON.phone}</span><select disabled={scan.busy} value={filters.model} onChange={e => setFilters({ ...filters, model: e.target.value, storage: [], colour: [] })}><option value="">Any model</option>{MODELS.map(m => <option key={m}>{m}</option>)}</select></div></label><div className="search-field"><span className="field-label">Storage <small>(select one or more)</small></span><div className="chip-group" role="group" aria-label="Storage">{STORAGE_ORDER.filter(s => modelProducts.some(p => p.storage === s)).map(s => <button type="button" key={s} disabled={scan.busy} aria-pressed={filters.storage.includes(s)} className={`chip${filters.storage.includes(s) ? ' active' : ''}`} onClick={() => toggleStorage(s)}>{s}</button>)}</div></div><div className="search-field"><span className="field-label">Colour <small>(select one or more)</small></span><div className="chip-group colour-group" role="group" aria-label="Colour">{[...new Set(modelProducts.map(p => p.colour))].map(c => { const swatch = COLOUR_SWATCHES[c]; return <button type="button" key={c} disabled={scan.busy} aria-pressed={filters.colour.includes(c)} className={`chip colour-chip${filters.colour.includes(c) ? ' active' : ''}`} onClick={() => toggleColour(c)}><i style={{ background: swatch?.fill ?? 'var(--placeholder)', borderColor: swatch?.border ?? 'transparent' }}/>{c}</button>; })}</div></div><label className="search-field">Search radius<div className="select-wrap"><span className="field-icon" aria-hidden="true">{ICON.radius}</span><select disabled={scan.busy} value={filters.radius} onChange={e => setFilters({ ...filters, radius: Number(e.target.value) })}>{[10, 25, 50, 100, 250, 500, 0].map(r => <option key={r} value={r}>{r ? `${r} km` : 'Australia-wide'}</option>)}</select></div></label><button className="button primary check-stock" type="submit" disabled={scan.busy || !locationValid || !products.length}>{ICON.search} {scan.busy ? 'Checking…' : 'Check stock'}</button></div></form>
      <div className="search-foot"><span className="muted">No account. Just availability.</span><button className="text-button" type="button" onClick={saveTarget}>☆ Save this search</button></div>
      {targets.length > 0 && <div className="targets"><span className="eyebrow">MY TARGETS</span>{targets.map(t => <div className="target" key={t.id}><button disabled={scan.busy} onClick={() => { setFilters(t.filters); setLocation(t.location); setLocationValid(true); check(t.filters, t.location); }}>{t.filters.model || 'Any model'} · {t.filters.storage.join('/') || 'Any storage'} {t.filters.colour.join('/')}</button><button aria-label="Remove saved target" onClick={() => { const next = targets.filter(x => x.id !== t.id); setTargets(next); writeLocal('targets', next); }}>×</button></div>)}</div>}
      <section className="results" aria-label="Stock results"><div className="results-head"><div className="results-title"><h2>{scan.busy ? availableStores ? `${availableStores} stores found so far` : 'Finding your next iPhone…' : scan.result.checkedAt ? availableStores ? `${availableStores} stores have stock` : scan.result.complete ? 'No stock found yet' : 'No availability confirmed yet' : 'Good things are worth finding.'}</h2>{scan.result.checkedAt && <span className="live-pill" role="status" title={`${filteredStores.length} stores checked ${filters.radius ? `within ${filters.radius} km` : 'across Australia'} · ${scan.busy ? 'Still checking…' : `Checked ${new Date(scan.result.checkedAt).toLocaleTimeString('en-AU')}`}`}><span className="dot" aria-hidden="true"/>{scan.busy ? 'Checking live…' : 'Live Telstra stock'}</span>}</div><div className="results-toolbar"><label className="check"><input type="checkbox" checked={filters.availableOnly} onChange={e => setFilters({ ...filters, availableOnly: e.target.checked })}/> Available only</label><select className="inline-select" value={changedOnly ? 'changed' : 'any'} onChange={e => setChangedOnly(e.target.value === 'changed')}><option value="any">Any change</option><option value="changed">Changed since last check</option></select><select className="inline-select" value={filters.state} onChange={e => setFilters({ ...filters, state: e.target.value })}><option value="">All states</option>{states.map(s => <option key={s}>{s}</option>)}</select>{scan.busy ? <button className="button secondary" onClick={scan.cancel}>Stop scan</button> : scan.result.checkedAt && <button className="button secondary" disabled={!locationValid} onClick={() => check()}>Refresh ↻</button>}</div></div>
      {scan.busy && <div className="progress" aria-hidden="true"><span/></div>}
      {needsScan && <p className="notice">Your search has changed. Check stock to update these results.</p>}
      {scan.error && <div className="notice" role="alert"><strong>Partial results</strong><p>{scan.error}</p>{scan.canResume && <button className="button secondary" disabled={scan.busy} onClick={() => void scan.run()}>Retry remaining stores</button>}</div>}
      {!rows.length && !scan.busy && <div className="empty"><span className="empty-symbol" aria-hidden="true">⌖</span><div><h3>{scan.result.checkedAt ? 'Nothing matching right now.' : 'Your search starts here.'}</h3><p>{scan.result.checkedAt ? 'Try another colour or capacity, widen your search, or check again shortly.' : 'We’ll show exact configurations, nearby stores and the quickest way to get there.'}</p></div></div>}
      {filteredStores.length > 0 && <StoreMap stores={filteredStores} stock={stock} center={location} onSelect={openStore} note={`Showing ${rows.length} of ${filteredStores.length} Telstra stores`}/>}
      {rows.map(store => <StoreRow key={store.code} store={store} products={products} stock={stock} diff={scan.diff} favourite={favourites.includes(store.code)} onFavourite={() => toggleFavourite(store.code)} onOpen={() => openStore(store)}/>)}
      <div className="monitor-bar"><span className="monitor-icon" aria-hidden="true">{ICON.bell}</span><div className="monitor-copy"><h3>Monitor this search</h3><p className="muted">We'll keep checking for new stock and notify you when it's available.</p></div><div className="monitor-refresh"><span>Auto-refresh every</span><select value={interval} onChange={e => setRefreshInterval(Number(e.target.value))}>{[[0, 'Off'], [30, '30 seconds'], [60, '60 seconds'], [120, '2 minutes'], [300, '5 minutes']].map(([n, title]) => <option key={n} value={n}>{title}</option>)}</select></div><label className="check"><input type="checkbox" checked={notify} onChange={e => void notifications(e.target.checked)}/> Notify me about new stock</label><label className="check"><input type="checkbox" checked={sound} onChange={e => { setSound(e.target.checked); writeLocal('sound', e.target.checked); }}/> Play a sound too</label><label className="check disabled" title="Email delivery isn't available yet"><input type="checkbox" disabled/> Email notifications {ICON.info}</label><button type="button" className="button primary start-monitor" onClick={startMonitoring}>{ICON.play} Start monitoring</button></div>
      </section>
    </>}
  </Suspense>{notice && <div className="notice toast" role="status">{notice}<button aria-label="Dismiss message" onClick={() => setNotice('')}>×</button></div>}</main><footer><span className="brand-small">Stock Finder <b>AU</b></span><p>Unofficial stock finder. Not affiliated with Apple or Telstra.</p><span>Stock is a snapshot. Call before travelling.</span></footer></>;
}
