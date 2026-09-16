import { useEffect, useState } from 'react';
import type { ProductVariant, StockPage, Store } from '../shared/types';
import { MODELS, STORAGE_ORDER } from '../data/products';
import { available, groupInventory } from '../shared/scan';
import { hoursToday } from '../shared/hours';
import { useScan } from '../client/useScan';
import { StoreActions } from '../components/StoreRow';
export default function Inventory({ store, products, onBack, onPage }: { store: Store; products: ProductVariant[]; onBack: () => void; onPage: (page: StockPage) => void }) {
  const scan = useScan(onPage), [showAll, setShowAll] = useState(false);
  function refresh() {
    if (store.latitude === null || store.longitude === null) return;
    void scan.run({ location: { label: store.name, lat: store.latitude, lon: store.longitude }, skus: products.map(p => p.sku), radius: 0, storeCode: store.code });
  }
  useEffect(() => { refresh(); return () => scan.cancel(); }, [store.code]);
  const rows = groupInventory(products, scan.result.stock, store.code), count = rows.filter(r => available(r.stock)).length;
  return <section><button className="text-button back" onClick={() => { scan.cancel(); onBack(); }}>← Back to results</button><div className="page-heading"><div><span className="eyebrow">TELSTRA STORE</span><h1>{store.name}</h1><p>{store.address}, {store.suburb} {store.state} {store.postcode}</p><p className="muted">{hoursToday(store)}</p><StoreActions store={store}/></div><button className="button primary" onClick={refresh} disabled={scan.busy}>Refresh stock ↻</button></div><div className="section-heading"><div><span className="eyebrow">LIVE IPHONE STOCK</span><h2>{count} of {products.length} variants available</h2><p className="muted">{scan.busy ? 'Checking every tracked configuration…' : scan.result.checkedAt ? `Last checked ${new Date(scan.result.checkedAt).toLocaleTimeString('en-AU')}` : 'Not checked yet'}</p></div><label className="check"><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)}/> Show unavailable / all SKUs</label></div>
    {(store.latitude === null || store.longitude === null) && <p role="alert" className="notice">Telstra did not supply this store’s coordinates. Its inventory cannot be queried reliably.</p>}
    {scan.error && <div className="notice" role="alert"><p>{scan.error}</p><button onClick={() => void scan.run()} disabled={scan.busy}>Retry remaining configurations</button></div>}
    {!showAll && !count && <div className="empty"><h3>{scan.busy ? 'Checking this store…' : scan.result.complete ? 'No available stock found' : 'No availability confirmed yet'}</h3><p>Show all SKUs to see each configuration and its check status.</p></div>}
    {MODELS.map(model => { const modelRows = rows.filter(r => r.product.model === model && (showAll || available(r.stock))); return modelRows.length ? <section className="inventory-model" key={model}><h2>{model}</h2>{STORAGE_ORDER.map(storage => { const variants = modelRows.filter(r => r.product.storage === storage); return variants.length ? <div className="inventory-storage" key={storage}><h3>{storage}</h3><div>{variants.map(({ product, stock }) => <div className="inventory-variant" key={product.sku}><span>{product.colour}</span><span className={available(stock) ? 'stock-yes' : 'muted'}>{available(stock) ? '✓ Available' : stock?.status === 'unavailable' ? '× Unavailable' : '— Unknown'}</span></div>)}</div></div> : null; })}</section> : null; })}
  </section>;
}
