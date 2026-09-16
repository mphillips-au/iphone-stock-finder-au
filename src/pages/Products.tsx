import { useEffect, useState } from 'react';
import type { Catalogue, Filters, Location } from '../shared/types';
import { COLOUR_SWATCHES, MODELS, STORAGE_ORDER } from '../data/products';
import { fetchPage } from '../client/api';

type Nearby = { loading: boolean; available: number; checked: number };

function ModelCard({ model, products, location, onCheck }: { model: string; products: Catalogue['variants']; location: Location; onCheck: (filters: Partial<Filters>) => void }) {
  const colours = [...new Set(products.map(p => p.colour))];
  const storages = STORAGE_ORDER.filter(s => products.some(p => p.storage === s));
  const [colour, setColour] = useState(colours[0]);
  const [storage, setStorage] = useState(storages[0]);
  const selected = products.find(p => p.colour === colour && p.storage === storage) ?? products[0];
  const gallery = selected.images?.length ? selected.images : selected.imageUrl ? [selected.imageUrl] : [];
  const [activeImage, setActiveImage] = useState(0);
  const [imageOk, setImageOk] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  useEffect(() => { setActiveImage(0); setImageOk(true); }, [selected.sku]);
  const mainImage = gallery[activeImage];
  useEffect(() => setImageLoaded(false), [mainImage]);
  const [nearby, setNearby] = useState<Nearby | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    setNearby({ loading: true, available: 0, checked: 0 });
    const timer = window.setTimeout(() => {
      void fetchPage({ lat: location.lat, lon: location.lon, skus: [selected.sku], from: 0, size: 10 }, abort.signal)
        .then(page => setNearby({ loading: false, available: page.stock.filter(s => s.status === 'available').length, checked: page.stores.length }))
        .catch(() => { if (!abort.signal.aborted) setNearby(null); });
    }, 350);
    return () => { window.clearTimeout(timer); abort.abort(); };
  }, [selected.sku, location.lat, location.lon]);
  const launch = new Date(selected.marketLaunchDate);
  const launched = launch.getTime() <= Date.now();
  const tz = model === 'iPhone Duo' ? 'Australia/Sydney' : 'Australia/Brisbane';
  const tzLabel = model === 'iPhone Duo' ? 'AEDT' : 'AEST';
  return <article className="tel-card">
    <div className="tel-panel">
      <p className="tel-brand">Apple</p>
      <h2 className="tel-title">{model}</h2>
      <div className="tel-field">
        <span className="tel-label">Colour: <strong>{colour}</strong></span>
        <div className="tel-swatches" role="group" aria-label="Colour">
          {colours.map(c => { const sw = COLOUR_SWATCHES[c] ?? { fill: '#ccc' }; return <button key={c} type="button" aria-pressed={c === colour} aria-label={c} className="tel-swatch" style={{ background: sw.fill, borderColor: sw.border ?? sw.fill, boxShadow: c === colour ? '0 0 0 2px #fff, 0 0 0 4px var(--blue)' : undefined }} onClick={() => setColour(c)}/>; })}
        </div>
      </div>
      <div className="tel-field">
        <span className="tel-label">Capacity</span>
        <div className="tel-capacity" role="group" aria-label="Capacity">
          {storages.map(s => <button key={s} type="button" aria-pressed={s === storage} className={`tel-cap${s === storage ? ' active' : ''}`} onClick={() => setStorage(s)}>{s}</button>)}
        </div>
      </div>
      <div className="tel-launch">
        <span className="tel-clock" aria-hidden="true">{launched ? '✓' : '◷'}</span>
        <div>
          <strong>{launched ? 'Tracking live availability' : 'Pre-order coming soon'}</strong>
          <p>{launched ? 'Available now — ' : 'Launches '}{launch.toLocaleString('en-AU', { timeZone: tz, day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' })} {tzLabel}</p>
        </div>
      </div>
      {nearby && <p className={`tel-nearby${nearby.available ? ' has-stock' : ''}`} role="status">
        {nearby.loading ? 'Checking nearby stores…' : nearby.checked ? nearby.available ? `Available at ${nearby.available} of the ${nearby.checked} nearest stores` : `No stock at the ${nearby.checked} nearest stores right now` : 'Nearby stock unavailable right now'}
      </p>}
      <button className="button primary tel-cta" onClick={() => onCheck({ model, storage: [storage], colour: [colour] })}>Check stock near me <span aria-hidden="true">→</span></button>
    </div>
    <div className="tel-visual">
      <div className="tel-photo">{mainImage && imageOk ? <>
        {!imageLoaded && <div className="tel-skeleton" aria-hidden="true"/>}
        <img key={mainImage} className={imageLoaded ? 'loaded' : ''} src={mainImage} alt={`${model} in ${colour}`} loading="lazy" decoding="async" onLoad={() => setImageLoaded(true)} onError={() => setImageOk(false)}/>
      </> : <div className="tel-visual-empty" aria-hidden="true"><span>{model === 'iPhone Duo' ? 'D' : '18'}</span></div>}</div>
      {gallery.length > 1 && <div className="tel-thumbs" role="group" aria-label={`${model} photos`}>
        {gallery.map((src, i) => <button key={src} type="button" className={`tel-thumb${i === activeImage ? ' active' : ''}`} aria-label={`Photo ${i + 1} of ${gallery.length}`} onClick={() => setActiveImage(i)}><img src={src} alt="" loading="lazy" decoding="async"/></button>)}
      </div>}
    </div>
  </article>;
}

export default function Products({ catalogue, location, onCheck }: { catalogue: Catalogue; location: Location; onCheck: (filters: Partial<Filters>) => void }) {
  const imageCount = catalogue.variants.filter(p => p.imageUrl).length;
  return <section>
    <div className="page-heading"><div><span className="eyebrow">THE LINEUP</span><h1>Find your favourite.</h1><p className="muted">Every colour. Every capacity. Three iPhones to track.</p></div></div>
    <p className="notice">{catalogue.discoveredCount} variants discovered · {imageCount ? 'Telstra imagery loaded' : 'Images unavailable — using placeholders'} · {catalogue.fallbackActive ? 'Fallback catalogue active' : 'Live catalogue'} · {catalogue.updatedAt ? `Metadata checked ${new Date(catalogue.updatedAt).toLocaleString('en-AU')}` : 'Metadata sync pending'}</p>
    {MODELS.map(model => <ModelCard key={model} model={model} products={catalogue.variants.filter(p => p.model === model)} location={location} onCheck={onCheck}/>)}
    <p className="fine-print">Images are loaded from Telstra product metadata when available. Fallback configurations and release dates are supplied by the project catalogue. Product merchandising status is separate from live store inventory. "Nearest stores" reflects a quick 10-store sample around your saved location, not a full radius scan.</p>
  </section>;
}
