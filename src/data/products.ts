import type { Model, ProductVariant } from '../shared/types';
export const STORAGE_ORDER = ['256GB', '512GB', '1TB', '2TB'];
export const MODELS: Model[] = ['iPhone 18 Pro', 'iPhone 18 Pro Max', 'iPhone Duo'];
// Approximate swatch colours for the on-brand colour pickers on the Products screen.
export const COLOUR_SWATCHES: Record<string, { fill: string; border?: string }> = {
  Burgundy: { fill: '#5c2333' },
  Silver: { fill: '#eef0f2', border: '#c9d0da' },
  Black: { fill: '#2b2b2d' },
  Glacier: { fill: '#d7e3ec', border: '#c2d2df' },
  'Night Sky': { fill: '#23262e' },
  'Star White': { fill: '#f3ede0', border: '#ded5c2' },
};
export const PRODUCT_PAGES: Record<Model, string> = {
  'iPhone 18 Pro': 'https://www.telstra.com.au/mobile-phones/mobiles-on-a-plan/apple/iphone-18-pro',
  'iPhone 18 Pro Max': 'https://www.telstra.com.au/mobile-phones/mobiles-on-a-plan/apple/iphone-18-pro-max',
  'iPhone Duo': 'https://www.telstra.com.au/mobile-phones/mobiles-on-a-plan/apple/iphone-duo',
};
// Telstra-hosted hero assets verified from the configured product pages. These keep
// the Products screen useful when the page's variant JSON is unavailable.
export const TELSTRA_IMAGE_FALLBACKS: Record<Model, string> = {
  'iPhone 18 Pro': 'https://www.telstra.com.au/content/dam/tcom/lego/apple/iphone18pro/logo_hero_large.png',
  'iPhone 18 Pro Max': 'https://www.telstra.com.au/content/dam/tcom/lego/apple/iphone18pro/hero_large.png',
  'iPhone Duo': 'https://www.telstra.com.au/content/dam/tcom/lego/apple/iphoneduofr/hero_medium.png',
};
const rows: [Model, string, string[], string[][]][] = [
  ['iPhone 18 Pro', 'MHDWHST-I18P', ['Burgundy', 'Silver', 'Black', 'Glacier'], [
    ['100257229', '100256788', '100256787', '100256786'],
    ['100257224', '100256794', '100256793', '100256792'],
    ['100257230', '100256800', '100256799', '100256798'],
    ['100257267', '100257266', '100257265', '100257264'],
  ]],
  ['iPhone 18 Pro Max', 'MHDWHST-I18P1', ['Burgundy', 'Silver', 'Black', 'Glacier'], [
    ['100257225', '100256806', '100256805', '100256804'],
    ['100257226', '100256812', '100256811', '100256810'],
    ['100257227', '100256818', '100256817', '100256816'],
    ['100257228', '100256824', '100256823', '100256822'],
  ]],
  ['iPhone Duo', 'MHDWHST-IPDU', ['Night Sky', 'Star White'], [
    ['100257566', '100256913'], ['100257567', '100256895'],
    ['100257569', '100256907'], ['100257570', '100256901'],
  ]],
];
export const FALLBACK_PRODUCTS: ProductVariant[] = rows.flatMap(([model, productCode, colours, skus]) =>
  skus.flatMap((row, i) => row.map((sku, j) => ({
    model, productCode, storage: STORAGE_ORDER[i], colour: colours[j], sku,
    deviceName: model, imageUrl: TELSTRA_IMAGE_FALLBACKS[model], source: 'fallback' as const,
    marketLaunchDate: model === 'iPhone Duo' ? '2026-10-23T08:00:00+11:00' : '2026-09-18T08:00:00+10:00',
    telstraLaunchDate: model === 'iPhone Duo' ? '2026-10-16T23:00:00+11:00' : '2026-09-12T21:09:00+10:00',
  }))),
);
