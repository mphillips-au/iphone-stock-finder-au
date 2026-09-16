import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { FALLBACK_PRODUCTS, MODELS, STORAGE_ORDER } from './data/products';
import { DEFAULT_FILTERS, DEFAULT_LOCATION, type Catalogue, type Filters, type Location, type StockPage, type Store } from './shared/types';
import { available, distance, matchingProducts, sortStores, stockKey } from './shared/scan';
import { readLocal, writeLocal } from './client/storage';
import { api } from './client/api';
import { useScan } from './client/useScan';
import LocationInput from './components/LocationInput';
import StoreRow from './components/StoreRow';
const Inventory = lazy(() => import('./pages/Inventory'));
const Products = lazy(() => import('./pages/Products'));
const Stores = lazy(() => import('./pages/Stores'));
const states = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'];
const validLocation = (v: unknown) => !!v && typeof v === 'object' && typeof (v as Location).label === 'string' && Number.isFinite((v as Location).lat) && Number.isFinite((v as Location).lon);
const validFilters = (v: unknown) => !!v && typeof v === 'object' && ['model', 'storage', 'colour', 'state'].every(k => typeof (v as Record<string, unknown>)[k] === 'string') && typeof (v as Filters).radius === 'number' && typeof (v as Filters).availableOnly === 'boolean';
type Target = { id: string; filters: Filters; location: Location };
export default function App() {
  const [page, setPage] = useState('find'), [selectedStore, setSelectedStore] = useState<Store>();
  const [location, setLocation] = useState(() => readLocal('location', DEFAULT_LOCATION, validLocation));
  const [locationValid, setLocationValid] = useState(true);
  const [filters, setFilters] = useState(() => readLocal('filters', DEFAULT_FILTERS, validFilters));
  const [catalogue, setCatalogue] = useState<Catalogue>({ variants: FALLBACK_PRODUCTS, updatedAt: '', fallbackActive: true, discoveredCount: 0 });
  const [directory, setDirectory] = useState<Store[]>(() => readLocal('stores', [], v => Array.isArray(v) && v.every(s => s && typeof s.code === 'string' && typeof s.name === 'string' && s.hours && typeof s.hours === 'object')));
  const [favourites, setFavourites] = useState<string[]>(() => readLocal('favourites', [], v => Array.isArray(v) && v.every(s => typeof s === 'string')));
  const [targets, setTargets] = useState<Target[]>(() => readLocal('targets', [], v => Array.isArray(v) && v.every(t => t && typeof t.id === 'string' && validLocation(t.location) && validFilters(t.filters))));
  const [interval, setRefreshInterval] = useState(0), [notify, setNotify] = useState(() => readLocal('notify', false, v => typeof v === 'boolean'));
  const [changedOnly, setChangedOnly] = useState(false), [notice, setNotice] = useState('');
  const notified = useRef(new Set<string>());
  function remember(p: StockPage) { setDirectory(previous => { const merged = [...new Map([...previous, ...p.stores].map(s => [s.code, s])).values()]; writeLocal('stores', merged); return merged; }); }
  const scan = useScan(remember);
  useEffect(() => { const abort = new AbortController(); void api<Catalogue>('/api/products', abort.signal).then(setCatalogue).catch(() => {}); return () => abort.abort(); }, []);
  useEffect(() => { writeLocal('location', location); writeLocal('filters', filters); }, [location, filters]);
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
  function check(nextFilters = filters, nextLocation = location) {
    notified.current.clear();
    const skus = matchingProducts(catalogue.variants, nextFilters).map(p => p.sku);
    if (skus.length) void scan.run({ location: nextLocation, skus, radius: nextFilters.radius });
  }
  function toggleFavourite(code: string) { setFavourites(previous => { const next = previous.includes(code) ? previous.filter(c => c !== code) : [...previous, code]; writeLocal('favourites', next); return next; }); }
  function navigate(next: string) { scan.cancel(); setSelectedStore(undefined); setPage(next); }
  function openStore(store: Store) { scan.cancel(); setSelectedStore(store); window.scrollTo({ top: 0 }); }
  function saveTarget() { const next = [...targets, { id: crypto.randomUUID(), filters, location }].slice(-12); setTargets(next); writeLocal('targets', next); setNotice('Saved to My targets.'); }
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
  const launch = modelProducts[0]?.marketLaunchDate;
  const days = launch ? Math.ceil((new Date(launch).getTime() - Date.now()) / 86400000) : 0;
  return <><header className="site-header"><a href="#" className="brand" onClick={e => { e.preventDefault(); navigate('find'); }}><span className="brand-mark" aria-hidden="true">s<span>f</span></span>Stock Finder<span className="country">AU</span></a><nav aria-label="Main navigation">{[['find', 'Find stock'], ['stores', 'Stores'], ['products', 'Products']].map(([id, title]) => <button key={id} className={page === id && !selectedStore ? 'active' : ''} aria-current={page === id && !selectedStore ? 'page' : undefined} onClick={() => navigate(id)}>{title}</button>)}</nav><span className="header-note">A better way to find it.</span></header><main id="main"><Suspense fallback={<p className="empty" role="status">Loading…</p>}>
    {selectedStore ? <Inventory key={selectedStore.code} store={selectedStore} products={catalogue.variants} onBack={() => setSelectedStore(undefined)} onPage={remember}/> : page === 'products' ? <Products catalogue={catalogue} onCheck={next => { const merged = { ...filters, ...next }; setFilters(merged); navigate('find'); check(merged); }}/> : page === 'stores' ? <Stores stores={directory.map(s => ({ ...s, distanceMetres: distance(location, s) }))} favourites={favourites} toggleFavourite={toggleFavourite} onOpen={openStore}/> : <>
      <section className="hero"><div><div className="eyebrow"><span className="blue-line"/> YOUR NEXT IPHONE. CLOSER THAN YOU THINK.</div><h1>Find your <em>iPhone.</em></h1><p>Live Telstra store availability.<br className="mobile-break"/> Less searching. More finding.</p></div><div className="launch-note"><span className="launch-symbol" aria-hidden="true">↗</span><div><strong>{filters.model || 'The new iPhone lineup'}</strong><span>{days > 0 ? `Launch in ${days} ${days === 1 ? 'day' : 'days'}` : 'Check local availability'}</span><small>Across Australia</small></div></div></section>
      <form className="search-surface" onSubmit={e => { e.preventDefault(); if (locationValid) check(); }}><LocationInput value={location} onChange={setLocation} onValid={setLocationValid} disabled={scan.busy}/><div className="search-grid"><label>Model<select disabled={scan.busy} value={filters.model} onChange={e => setFilters({ ...filters, model: e.target.value, storage: '', colour: '' })}><option value="">Any model</option>{MODELS.map(m => <option key={m}>{m}</option>)}</select></label><label>Storage<select disabled={scan.busy} value={filters.storage} onChange={e => setFilters({ ...filters, storage: e.target.value })}><option value="">Any storage</option>{STORAGE_ORDER.filter(s => modelProducts.some(p => p.storage === s)).map(s => <option key={s}>{s}</option>)}</select></label><label>Colour<select disabled={scan.busy} value={filters.colour} onChange={e => setFilters({ ...filters, colour: e.target.value })}><option value="">Any colour</option>{[...new Set(modelProducts.map(p => p.colour))].map(c => <option key={c}>{c}</option>)}</select></label><label>Within<select disabled={scan.busy} value={filters.radius} onChange={e => setFilters({ ...filters, radius: Number(e.target.value) })}>{[10, 25, 50, 100, 250, 500, 0].map(r => <option key={r} value={r}>{r ? `${r} km` : 'Australia-wide'}</option>)}</select></label><button className="button primary check-stock" type="submit" disabled={scan.busy || !locationValid || !products.length}>{scan.busy ? 'Checking…' : 'Check stock'} <span aria-hidden="true">→</span></button></div><div className="search-bottom"><span>No account. Just availability.</span><button className="text-button" type="button" onClick={saveTarget}>☆ Save this search</button></div></form>
      {targets.length > 0 && <div className="targets"><span className="eyebrow">MY TARGETS</span>{targets.map(t => <div className="target" key={t.id}><button disabled={scan.busy} onClick={() => { setFilters(t.filters); setLocation(t.location); setLocationValid(true); check(t.filters, t.location); }}>{t.filters.model || 'Any model'} · {t.filters.storage || 'Any storage'} {t.filters.colour}</button><button aria-label="Remove saved target" onClick={() => { const next = targets.filter(x => x.id !== t.id); setTargets(next); writeLocal('targets', next); }}>×</button></div>)}</div>}
      <section className="results" aria-label="Stock results"><div className="section-heading"><div><span className="eyebrow">AVAILABLE NEAR YOU</span><h2>{scan.busy ? availableStores ? `${availableStores} stores found so far` : 'Finding your next iPhone…' : scan.result.checkedAt ? availableStores ? `${availableStores} stores have stock` : scan.result.complete ? 'No stock found yet' : 'No availability confirmed yet' : 'Good things are worth finding.'}</h2><p className="muted" role="status">{scan.result.checkedAt ? `${filteredStores.length} stores checked ${filters.radius ? `within ${filters.radius} km` : 'across Australia'} · ${scan.busy ? 'Still checking…' : `Checked ${new Date(scan.result.checkedAt).toLocaleTimeString('en-AU')}`}` : 'Choose your configuration. We’ll check the stores around you.'}</p></div><div className="result-actions">{scan.busy ? <button className="button secondary" onClick={scan.cancel}>Stop scan</button> : scan.result.checkedAt && <button className="button secondary" disabled={!locationValid} onClick={() => check()}>Refresh ↻</button>}</div></div>
      <div className="result-toolbar"><label className="check"><input type="checkbox" checked={filters.availableOnly} onChange={e => setFilters({ ...filters, availableOnly: e.target.checked })}/> Available only</label><label className="check"><input type="checkbox" checked={changedOnly} onChange={e => setChangedOnly(e.target.checked)}/> Changed since last check</label><label className="inline-select">State<select value={filters.state} onChange={e => setFilters({ ...filters, state: e.target.value })}><option value="">Any state</option>{states.map(s => <option key={s}>{s}</option>)}</select></label></div>
      {scan.busy && <div className="progress" aria-hidden="true"><span/></div>}
      {needsScan && <p className="notice">Your search has changed. Check stock to update these results.</p>}
      {scan.error && <div className="notice" role="alert"><strong>Partial results</strong><p>{scan.error}</p>{scan.canResume && <button className="button secondary" disabled={scan.busy} onClick={() => void scan.run()}>Retry remaining stores</button>}</div>}
      {!rows.length && !scan.busy && <div className="empty"><span className="empty-symbol" aria-hidden="true">⌖</span><div><h3>{scan.result.checkedAt ? 'Nothing matching right now.' : 'Your search starts here.'}</h3><p>{scan.result.checkedAt ? 'Try another colour or capacity, widen your search, or check again shortly.' : 'We’ll show exact configurations, nearby stores and the quickest way to get there.'}</p></div></div>}
      {rows.map(store => <StoreRow key={store.code} store={store} products={products} stock={stock} diff={scan.diff} favourite={favourites.includes(store.code)} onFavourite={() => toggleFavourite(store.code)} onOpen={() => openStore(store)}/>)}
      <div className="monitor"><div><h3>Keep an eye on it.</h3><p className="muted">Refresh while this tab is open. Stock can change quickly.</p></div><label>Auto refresh<select value={interval} onChange={e => setRefreshInterval(Number(e.target.value))}>{[[0, 'Off'], [30, '30 seconds'], [60, '60 seconds'], [120, '2 minutes'], [300, '5 minutes']].map(([n, title]) => <option key={n} value={n}>{title}</option>)}</select></label><label className="check"><input type="checkbox" checked={notify} onChange={e => void notifications(e.target.checked)}/> Notify me when stock appears</label></div>
      </section>
    </>}
  </Suspense>{notice && <div className="notice toast" role="status">{notice}<button aria-label="Dismiss message" onClick={() => setNotice('')}>×</button></div>}</main><footer><span className="brand-small">Stock Finder <b>AU</b></span><p>Unofficial stock finder. Not affiliated with Apple or Telstra.</p><span>Stock is a snapshot. Call before travelling.</span></footer></>;
}
