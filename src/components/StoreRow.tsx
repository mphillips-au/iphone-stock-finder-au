import type { ProductVariant, Stock, Store } from '../shared/types';
import { available, stockKey } from '../shared/scan';
import { hoursToday } from '../shared/hours';
import { COLOUR_SWATCHES } from '../data/products';
const ICONS = {
  call: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 5.5c0-1.1.9-2 2-2H8l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4 1.5v2.5c0 1.1-.9 2-2 2C9.4 19 5 14.6 3.5 8.5V5.5Z"/></svg>,
  pin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s7-7.4 7-12.5A7 7 0 0 0 5 9.5C5 14.6 12 22 12 22Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>,
  calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>,
  phone: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2" strokeLinecap="round"/></svg>,
  store: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9.5 5 4h14l1 5.5"/><path d="M4 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0"/><path d="M5 9.8V20h14V9.8"/><path d="M10 20v-5h4v5"/></svg>,
  chevron: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>,
};
export function StoreActions({ store }: { store: Store }) {
  const destination = store.latitude !== null && store.longitude !== null ? `${store.latitude},${store.longitude}` : `${store.address} ${store.suburb} ${store.state} ${store.postcode}`;
  return <div className="store-actions">{store.phone && <a className="button secondary" href={`tel:${store.phone.replace(/[^+\d]/g, '')}`}>{ICONS.call} Call store</a>}<a className="button secondary" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`}>{ICONS.pin} Directions</a><a className="button primary" target="_blank" rel="noreferrer" href={`https://www.telstra.com.au/telstra-store/appointments?storecode=${store.code}`}>{ICONS.calendar} Book appointment</a></div>;
}
export default function StoreRow({ store, stock, products, diff = {}, favourite, onFavourite, onOpen }: { store: Store; stock: Stock[]; products: ProductVariant[]; diff?: Record<string, 'new' | 'gone'>; favourite: boolean; onFavourite: () => void; onOpen: () => void }) {
  const records = stock.filter(s => s.storeCode === store.code), inStock = records.filter(available);
  const knownUnavailable = records.length === products.length && records.every(s => s.status === 'unavailable');
  const visible = inStock.length ? inStock : records.filter(s => diff[stockKey(s)] === 'gone');
  const badge = inStock.length >= 2 ? { cls: 'in-stock', label: 'In stock' } : inStock.length === 1 ? { cls: 'limited', label: 'Limited stock' } : null;
  return <article className="store-card-row">
    <div className="store-thumb" aria-hidden="true">{ICONS.store}</div>
    <div className="store-info">
      <div className="store-info-head">
        <h3><button className="title-button" onClick={onOpen}>{store.name}</button></h3>
        {badge && <span className={`status-badge ${badge.cls}`}><span className="dot" aria-hidden="true"/>{badge.label}</span>}
        <button className="star" aria-label={`${favourite ? 'Unsave' : 'Save'} ${store.name}`} aria-pressed={favourite} onClick={onFavourite}>{favourite ? '★' : '☆'}</button>
      </div>
      <p className="muted store-address">{store.address}, {store.suburb} {store.state} {store.postcode}</p>
      <p className="muted store-meta">{store.distanceMetres === null ? 'Distance unknown' : `${(store.distanceMetres / 1000).toFixed(1)} km`} <span className="dot">·</span> {hoursToday(store)}</p>
    </div>
    <div className="store-stock-panel">
      <span className="panel-label">{inStock.length ? 'In stock' : knownUnavailable ? 'Unavailable' : 'Checking…'}</span>
      <ul className="variant-rows">{visible.map(s => { const product = products.find(p => p.sku === s.sku); if (!product) return null; const swatch = COLOUR_SWATCHES[product.colour]; return <li key={s.sku} onClick={onOpen}>
        <span className="variant-icon" aria-hidden="true">{ICONS.phone}</span>
        <span className="variant-name">{product.model} {product.storage}</span>
        <span className="variant-colour"><i style={{ background: swatch?.fill ?? 'var(--placeholder)', borderColor: swatch?.border ?? 'transparent' }}/>{product.colour}</span>
        {diff[stockKey(s)] && <span className={diff[stockKey(s)] === 'new' ? 'new-stock' : 'muted'}>{diff[stockKey(s)] === 'new' ? 'NEW' : 'GONE'}</span>}
        <span className="chevron" aria-hidden="true">{ICONS.chevron}</span>
      </li>; })}</ul>
      <StoreActions store={store}/>
    </div>
  </article>;
}
