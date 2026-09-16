import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Location, Stock, Store } from '../shared/types';
import { available } from '../shared/scan';
// Free, key-less tile source — OpenStreetMap's own tile server. Fine at this app's
// traffic (a handful of map loads per session, not per-store-check), and it's the
// only zero-setup option that doesn't need an API key or billing account.
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
function markerIcon(colour: string, big = false) {
  const size = big ? 26 : 18;
  return L.divIcon({
    className: 'store-pin', html: `<span style="background:${colour};width:${size}px;height:${size}px"></span>`,
    iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2 - 2],
  });
}
export default function StoreMap({ stores, stock, center, onSelect, note }: { stores: Store[]; stock: Stock[]; center: Location; onSelect?: (store: Store) => void; note?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [locating, setLocating] = useState(false);
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { scrollWheelZoom: false, zoomControl: false });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 18 }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);
  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const withCoords = stores.filter(s => s.latitude !== null && s.longitude !== null);
    const points: L.LatLngExpression[] = [[center.lat, center.lon], ...withCoords.map(s => [s.latitude as number, s.longitude as number] as L.LatLngExpression)];
    L.marker([center.lat, center.lon], { icon: markerIcon('var(--blue, #2455ed)') }).bindPopup('Your search location').addTo(layer);
    for (const store of withCoords) {
      const hasStock = stock.some(s => s.storeCode === store.code && available(s));
      L.marker([store.latitude as number, store.longitude as number], { icon: markerIcon(hasStock ? 'var(--green, #18714d)' : 'var(--muted-2, #596374)') })
        .bindPopup(`<div class="map-popup"><strong>${store.name}</strong>${hasStock ? '<span class=\'map-popup-badge\'><span class=\'dot\'></span>In stock</span>' : ''}<p>${store.address ? store.address + ', ' : ''}${store.suburb} ${store.state}</p></div>`)
        .on('click', () => onSelect?.(store))
        .addTo(layer);
    }
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 13 });
    else map.setView(points[0], 11);
  }, [stores, stock, center, onSelect]);
  function locate() {
    const map = mapRef.current;
    if (!map || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(p => { map.setView([p.coords.latitude, p.coords.longitude], 13); setLocating(false); }, () => setLocating(false), { timeout: 10000 });
  }
  return <div className="store-map-card">
    <div className="store-map-bar">
      <div className="map-tabs" role="group" aria-label="Map view"><button type="button" className="active">Map</button><button type="button" disabled title="Satellite view isn't available yet">Satellite</button></div>
      {note && <span className="map-note">{note}</span>}
    </div>
    <div className="store-map" ref={containerRef} role="img" aria-label={`Map of ${stores.length} stores near ${center.label}`}/>
    <button type="button" className="map-locate" onClick={locate} disabled={locating} aria-label="Centre map on my location">{locating ? '…' : '⌖'}</button>
  </div>;
}
