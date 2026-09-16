import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Location, Stock, Store } from '../shared/types';
import { available } from '../shared/scan';
// Free, key-less tile source — OpenStreetMap's own tile server. Fine at this app's
// traffic (a handful of map loads per session, not per-store-check), and it's the
// only zero-setup option that doesn't need an API key or billing account.
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
function markerIcon(colour: string) {
  return L.divIcon({
    className: 'store-pin', html: `<span style="background:${colour}"></span>`,
    iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -10],
  });
}
export default function StoreMap({ stores, stock, center, onSelect }: { stores: Store[]; stock: Stock[]; center: Location; onSelect?: (store: Store) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { scrollWheelZoom: false });
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
        .bindPopup(`<strong>${store.name}</strong><br>${store.suburb} ${store.state}${hasStock ? '<br><b>Stock available</b>' : ''}`)
        .on('click', () => onSelect?.(store))
        .addTo(layer);
    }
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 13 });
    else map.setView(points[0], 11);
  }, [stores, stock, center, onSelect]);
  return <div className="store-map" ref={containerRef} role="img" aria-label={`Map of ${stores.length} stores near ${center.label}`}/>;
}
