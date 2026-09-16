import type { Location, Stock, Store } from '../../shared/types';
export function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
export const string = (value: unknown): string => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
export function number(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value); return Number.isFinite(n) ? n : null;
}
export function normaliseStock(payload: unknown, allowedSkus: string[]): { stores: Store[]; stock: Stock[] } {
  const data = object(object(payload).data);
  if (!Array.isArray(data.storeDetails) || !Array.isArray(data.checkProductStockItem)) throw new Error('Unexpected stock response');
  const stores = new Map<string, Store>();
  for (const raw of data.storeDetails) {
    const s = object(raw), code = string(s.storecode);
    if (!code) continue;
    const latitude = number(s.latitude), longitude = number(s.longitude), distance = number(s.distance);
    stores.set(code, {
      code, name: string(s.title) || `Telstra ${code}`, address: string(s.address), suburb: string(s.suburb),
      postcode: string(s.postcode), state: string(s.state).toUpperCase(), phone: string(s.phone) || undefined,
      latitude: latitude !== null && Math.abs(latitude) <= 90 ? latitude : null,
      longitude: longitude !== null && Math.abs(longitude) <= 180 ? longitude : null,
      distanceMetres: distance !== null && distance >= 0 ? distance : null,
      hours: Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => [day, string(s[`hrs_${day}`])])),
    });
  }
  const stock = new Map<string, Stock>();
  for (const raw of data.checkProductStockItem) {
    const s = object(object(raw).checkedProductStock), product = object(s.stockedProduct);
    const characteristics = array(product.productCharacteristic).map(object);
    const skuType = characteristics.find(c => string(c.name) === 'SKU Code Type');
    if (skuType && string(skuType.value) !== 'RIMS') continue;
    const sku = string(characteristics.find(c => string(c.name) === 'SKU')?.value);
    const storeCode = string(object(s.place).id);
    if (!allowedSkus.includes(sku) || !stores.has(storeCode)) continue;
    const item = { storeCode, sku, status: string(s.productStockStatusType) || 'unknown', usageType: string(s.productStockUsageType) };
    const key = `${storeCode}:${sku}`, previous = stock.get(key);
    stock.set(key, previous && previous.status !== item.status ? { ...item, status: 'unknown' } : item);
  }
  return { stores: [...stores.values()], stock: [...stock.values()] };
}
export function normaliseGeo(payload: unknown): Location[] {
  const root = object(payload), data = root.data ?? payload, d = object(data);
  const candidates = Array.isArray(data) ? data : array(d.results ?? d.addresses ?? d.locations ?? d.suggestions ?? d.features);
  const results = new Map<string, Location>();
  for (const raw of candidates) {
    const item = object(raw), a = { ...item, ...object(item.properties), ...object(item.address) };
    const coords = object(a.centrePoint ?? a.geographicLocation ?? a.location ?? a.coordinates ?? a.geometry), pair = array(coords.coordinates);
    const lat = number(a.latitude ?? a.lat ?? coords.latitude ?? coords.lat ?? pair[1]);
    const lon = number(a.longitude ?? a.lon ?? coords.longitude ?? coords.lon ?? pair[0]);
    if (lat === null || lon === null || lat < -44 || lat > -9 || lon < 112 || lon > 154) continue;
    const suburb = string(a.suburb ?? a.locality), postcode = string(a.postcode ?? a.postalCode), state = string(a.state ?? a.stateTerritory);
    const label = string(a.label ?? a.display ?? a.formattedAddress ?? a.displayName) || [suburb, state, postcode].filter(Boolean).join(' ');
    if (label) results.set(`${lat}:${lon}:${label}`, { label, suburb, postcode, state, lat, lon });
  }
  return [...results.values()];
}
