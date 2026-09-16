import { useEffect, useState } from 'react';
import type { Catalogue, Filters } from '../shared/types';
import { COLOUR_SWATCHES, MODELS, PRODUCT_PAGES, STORAGE_ORDER } from '../data/products';

function ModelCard({ model, index, products, onCheck }: { model: string; index: number; products: Catalogue['variants']; onCheck: (filters: Partial<Filters>) => void }) {
  const colours = [...new Set(products.map(p => p.colour))];
  const storages = STORAGE_ORDER.filter(s => products.some(p => p.storage === s));
  const [colour, setColour] = useState(colours[0]);
  const [storage, setStorage] = useState(storages[0]);
  const selected = products.find(p => p.colour === colour && p.storage === storage) ?? products[0];
  const [imageOk, setImageOk] = useState(true);
  useEffect(() => setImageOk(true), [selected.imageUrl]);
  const launch = new Date(selected.marketLaunchDate);
  const launched = launch.getTime() <= Date.now();
  const tz = model === 'iPhone Duo' ? 'Australia/Sydney' : 'Australia/Brisbane';
  const tzLabel = model === 'iPhone Duo' ? 'AEDT' : 'AEST';
  return <article className="tel-card">
    <div className="tel-panel">
      <p className="tel-brand">Apple</p>
      <h2 className="tel-title">{model}</h2>
      <a className="tel-pill" href={PRODUCT_PAGES[model as keyof typeof PRODUCT_PAGES]} target="_blank" rel="noreferrer">iPhone 18 range <span aria-hidden="true">⌄</span></a>
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
      <button className="button primary tel-cta" onClick={() => onCheck({ model, storage: [storage], colour: [colour] })}>Check stock near me <span aria-hidden="true">→</span></button>
      <details>
        <summary>Explore all configurations and SKUs</summary>
        {storages.map(s => <div className="catalogue-storage" key={s}><h3>{s}</h3>{products.filter(p => p.storage === s).map(p => <div className="catalogue-row" key={p.sku}><span>{p.colour}</span><small>{p.sku} · {p.productCode} · {p.source}</small></div>)}</div>)}
      </details>
    </div>
    <div className="tel-visual">
      <div className="tel-photo">{selected.imageUrl && imageOk ? <img src={selected.imageUrl} alt={`${model} in ${colour}`} loading="lazy" decoding="async" onError={() => setImageOk(false)}/> : <div className="tel-visual-empty" aria-hidden="true"><span>{model === 'iPhone Duo' ? 'D' : '18'}</span></div>}</div>
      <div className="tel-thumbs" role="group" aria-label="Colour thumbnails">
        {colours.map(c => { const sw = COLOUR_SWATCHES[c] ?? { fill: '#ccc' }; return <button key={c} type="button" className={`tel-thumb${c === colour ? ' active' : ''}`} aria-label={`View ${c}`} onClick={() => setColour(c)}><span style={{ background: sw.fill, borderColor: sw.border ?? sw.fill }}/></button>; })}
      </div>
      <div className="tel-number" aria-hidden="true">0{index + 1}</div>
    </div>
  </article>;
}

export default function Products({ catalogue, onCheck }: { catalogue: Catalogue; onCheck: (filters: Partial<Filters>) => void }) {
  const imageCount = catalogue.variants.filter(p => p.imageUrl).length;
  return <section>
    <div className="page-heading"><div><span className="eyebrow">THE LINEUP</span><h1>Find your favourite.</h1><p className="muted">Every colour. Every capacity. Three iPhones to track.</p></div></div>
    <p className="notice">{catalogue.discoveredCount} variants discovered · {imageCount ? 'Telstra imagery loaded' : 'Images unavailable — using placeholders'} · {catalogue.fallbackActive ? 'Fallback catalogue active' : 'Live catalogue'} · {catalogue.updatedAt ? `Metadata checked ${new Date(catalogue.updatedAt).toLocaleString('en-AU')}` : 'Metadata sync pending'}</p>
    {MODELS.map((model, i) => <ModelCard key={model} model={model} index={i} products={catalogue.variants.filter(p => p.model === model)} onCheck={onCheck}/>)}
    <p className="fine-print">Images are loaded from Telstra product metadata when available. Fallback configurations and release dates are supplied by the project catalogue. Product merchandising status is separate from live store inventory.</p>
  </section>;
}
