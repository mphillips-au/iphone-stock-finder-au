export type Model = 'iPhone 18 Pro' | 'iPhone 18 Pro Max' | 'iPhone Duo';
export interface ProductVariant {
  model: Model; storage: string; colour: string; sku: string; productCode: string;
  deviceName: string; marketLaunchDate: string; telstraLaunchDate?: string;
  imageUrl?: string; images?: string[]; merchandisingStatus?: string; merchandisingMessage?: string;
  source: 'fallback' | 'discovered';
}
export interface Store {
  code: string; name: string; address: string; suburb: string; postcode: string;
  state: string; phone?: string; latitude: number | null; longitude: number | null;
  distanceMetres: number | null; hours: Record<string, string>;
}
export interface Stock { storeCode: string; sku: string; status: string; usageType: string }
export interface Location { label: string; suburb?: string; postcode?: string; state?: string; lat: number; lon: number }
export interface PageInput { lat: number; lon: number; skus: string[]; from: number; size: 10 }
export interface StockPage {
  stores: Store[]; stock: Stock[]; from: number; nextFrom: number | null;
  checkedAt: string; failedSkus: string[]; complete: boolean; warning?: string;
}
export interface Catalogue { variants: ProductVariant[]; updatedAt: string; fallbackActive: boolean; discoveredCount: number }
export interface Filters { model: string; storage: string[]; colour: string[]; radius: number; state: string; availableOnly: boolean }
export const DEFAULT_LOCATION: Location = { label: 'Port Melbourne VIC 3207', suburb: 'Port Melbourne', state: 'VIC', postcode: '3207', lat: -37.83801318, lon: 144.93842178 };
export const DEFAULT_FILTERS: Filters = { model: 'iPhone 18 Pro Max', storage: [], colour: [], radius: 50, state: '', availableOnly: true };
