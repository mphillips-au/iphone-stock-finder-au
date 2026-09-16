# BUILD THIS END TO END: IPHONE STOCK FINDER

Build a production-quality, extremely fast web application for finding live Telstra retail store stock of newly released Apple iPhones in Australia.

This is a personal launch-day utility.

Do not stop at scaffolding, mockups, partial components, or pseudo-code. Build the complete working application, run the build/tests, fix issues, and leave it deployable to Cloudflare.

The application should feel exceptionally polished, fast and premium. Think Apple-level restraint, typography and product presentation combined with subtle Telstra-inspired energy and colour, while remaining an original interface and clearly unofficial.

Add a subtle footer:

“Unofficial stock finder. Not affiliated with Apple or Telstra.”

Do not make the app look like an official Telstra or Apple property.

---

# 1. PRIMARY PURPOSE

The main use case is:

> I open the app on iPhone launch morning, enter my suburb or postcode, choose the iPhone configuration I want, press Check Stock, and immediately see the closest Telstra stores where that exact phone is physically available.

The second equally important use case is:

> I open a specific Telstra store and see exactly which tracked iPhone SKUs that store currently has available.

This second workflow is critical.

The app should answer:

1. Which Telstra stores near me have the phone I want?
2. What colours/storage combinations are available nearby?
3. Which store is closest?
4. What exactly does a specific Telstra store have in stock?
5. Has stock appeared since my previous scan?
6. Which stock is newly available?
7. When was stock last checked?
8. How far away is the store?
9. Is it available in-store?
10. What are the store’s opening hours and phone number?

Speed, clarity and reliability matter more than generic dashboard features.

---

# 2. DEPLOYMENT / STACK

Use Cloudflare, not Vercel.

Preferred stack:

- React
- Vite
- TypeScript
- Tailwind CSS or similarly lightweight styling
- Cloudflare Workers
- Cloudflare static assets
- Wrangler

Do not use:

- Supabase
- Postgres
- Neon
- Redis
- Upstash
- Firebase
- external database
- traditional backend server

For v1, the entire application should deploy as one Cloudflare project.

Use browser localStorage for:

- favourite configurations
- previous scan state
- last selected location
- default filters
- change detection state
- notification preferences
- favourite stores

No authentication is required.

---

# 3. HIGH-LEVEL ARCHITECTURE

Use this architecture:

Browser
→ Cloudflare Worker API
→ Telstra endpoints
→ normalised data
→ frontend

All Telstra requests must happen server-side inside the Cloudflare Worker.

Do not call Telstra directly from client-side JavaScript because of CORS and because upstream integration logic should be isolated.

The browser should only call our own app API.

Serve the frontend as Cloudflare static assets.

---

# 4. IMPORTANT CLOUDFLARE FREE-TIER CONSTRAINTS

Design specifically to work well on Cloudflare Workers free tier.

Keep each Worker invocation comfortably under outbound subrequest limits.

Do NOT implement one giant Worker request that tries to perform:

26 store pages × multiple SKU batches

inside a single invocation.

Instead prefer:

Browser
→ our Worker `/api/stock/page`
→ Worker queries one Telstra store page with safe SKU batches
→ response returned
→ browser continues pagination progressively

This keeps Worker invocations small, fast and safe.

The frontend can orchestrate pagination progressively.

The browser must still never call Telstra directly.

Cloudflare Worker time should mostly be spent waiting on fetch calls, not performing CPU-heavy work.

Keep parsing lightweight.

---

# 5. TELSTRA STOCK API

Use:

POST

https://prod.okapi.ogw.evolve.okapi.telstra.com/tcom-ext/v1/stock/check

Content-Type:

application/json

Example body:

```json
{
  "correlationId": "GENERATED-UUID",
  "lat": "-37.83801318",
  "lon": "144.93842178",
  "products": ["100256812"],
  "from": 0,
  "size": 10
}
```

Generate a new UUID correlationId for each upstream Telstra request.

---

# 6. VERIFIED TELSTRA STOCK API BEHAVIOUR

This behaviour has been manually tested.

## Store page size

`size` must be 10.

Requests using values greater than 10 returned HTTP 413 from Telstra’s downstream BAPI.

Therefore production code should always use:

```json
{
  "size": 10
}
```

Do not attempt to increase this.

## Pagination

Pagination works using:

```text
from: 0
from: 10
from: 20
from: 30
...
```

A full Australia-wide scan returned:

- 10 stores per page through `from=240`
- `from=250` returned 7 stores
- total 257 stores

Do not hard-code 257 permanently.

Continue until:

- `storeDetails.length === 0`, OR
- `storeDetails.length < 10`

The network may change.

---

# 7. STOCK RESPONSE STRUCTURE

The Telstra response includes:

```text
data.checkProductStockItem
data.storeDetails
```

Each stock item contains approximately:

```text
checkedProductStock.stockLevelCategory
checkedProductStock.channel
checkedProductStock.place.id
checkedProductStock.productStockStatusType
checkedProductStock.productStockUsageType
checkedProductStock.stockedProduct.name
checkedProductStock.stockedProduct.productCharacteristic
requestedQuantity
```

RIMS SKU appears inside product characteristics:

```text
SKU Code Type = RIMS
SKU = 100xxxxxx
```

Store information is inside:

```text
data.storeDetails
```

Join:

```text
checkedProductStock.place.id
```

to:

```text
storeDetails[].storecode
```

---

# 8. INTERPRETING STOCK

Observed available inventory:

```text
productStockStatusType = "available"
```

Common usage:

```text
productStockUsageType = "inStoreOnly"
```

Observed unavailable inventory:

```text
productStockStatusType = "unavailable"
productStockUsageType = "pickupUnavailable"
```

The app should consider an item available when:

```ts
productStockStatusType === "available"
```

Do not assume `inStoreOnly` is the only available usage state.

Preserve and display unknown/other usage states safely.

---

# 9. STORE DATA

Observed `storeDetails` fields include:

```text
latitude
longitude
title
address
suburb
postcode
state
phone
store_email
storecode
distance
hrs_mon
hrs_tue
hrs_wed
hrs_thu
hrs_fri
hrs_sat
hrs_sun
```

Distance appears to be metres.

Internally keep metres.

Display kilometres.

Sort nearest-first by default.

---

# 10. SUBURB / POSTCODE LOOKUP

Users should never need to enter latitude or longitude manually.

Primary location field:

“Suburb or postcode”

Examples:

```text
Port Melbourne
3207
South Yarra
3000
```

Use Telstra’s own geo endpoint server-side:

POST

https://prod.okapi.ogw.evolve.okapi.telstra.com/tcom-ext/v1/geo/unstructured

Headers:

```text
Content-Type: application/json
source: tcom
```

Example request:

```json
{
  "query": "3207",
  "granularity": [
    "SUBURB",
    "POSTCODE"
  ],
  "pagination": {
    "size": "10"
  }
}
```

Normalise results into something like:

```ts
interface GeoResult {
  label: string
  suburb?: string
  postcode?: string
  state?: string
  lat: number
  lon: number
}
```

Implement debounced autocomplete.

Do not issue upstream requests for every keystroke.

Cache geo results for hours/days.

Store the user’s recent location locally.

Default first-run location:

Port Melbourne VIC 3207

Known working coordinates:

```text
lat: -37.83801318
lon: 144.93842178
```

Also support:

“Use my location”

via browser geolocation only after explicit user action.

Location permission must not be required.

---

# 11. TRACKED PRODUCTS

Track:

1. iPhone 18 Pro
2. iPhone 18 Pro Max
3. iPhone Duo

There is no standard iPhone 18 product to add.

---

# 12. TELSTRA PRODUCT PAGES

iPhone 18 Pro:

https://www.telstra.com.au/mobile-phones/mobiles-on-a-plan/apple/iphone-18-pro

iPhone 18 Pro Max:

https://www.telstra.com.au/mobile-phones/mobiles-on-a-plan/apple/iphone-18-pro-max

iPhone Duo:

https://www.telstra.com.au/mobile-phones/mobiles-on-a-plan/apple/iphone-duo

---

# 13. AUTO-DISCOVER PRODUCT VARIANTS / SKUS

Telstra product pages contain variant JSON in elements like:

```html
<div data-mobile-variant='...JSON...'></div>
```

They also contain:

```html
<div data-sku-array="SKU1,SKU2,..."></div>
```

Prefer `data-mobile-variant` because it contains metadata.

Observed variant fields include:

```text
colour
storage
id
brand
name
deviceName
sku
marketLaunchDate
telstraLaunchDate
merchandisingStatus
merchandisingMessage
simFormFactor
images
```

Server-side:

1. fetch each configured product page
2. parse all `[data-mobile-variant]`
3. decode JSON safely
4. deduplicate by SKU
5. normalise into our own stable internal model

Telstra repeats some variant nodes in the HTML.

Deduplicate using:

```ts
Map<sku, ProductVariant>
```

Do not show duplicates.

Cache product metadata around 15-60 minutes.

---

# 14. STATIC FALLBACK PRODUCT DATABASE

Automatic discovery must never be the only source.

If Telstra changes page markup on launch morning, the stock finder must keep working.

Include the following static fallback catalogue.

---

# 15. IPHONE 18 PRO

Product code:

`MHDWHST-I18P`

Market launch:

`2026-09-18T08:00:00+1000`

Telstra launch metadata:

`2026-09-12T21:09:00+1000`

## 256GB

Burgundy:
`100257229`

Silver:
`100256788`

Black:
`100256787`

Glacier:
`100256786`

## 512GB

Burgundy:
`100257224`

Silver:
`100256794`

Black:
`100256793`

Glacier:
`100256792`

## 1TB

Burgundy:
`100257230`

Silver:
`100256800`

Black:
`100256799`

Glacier:
`100256798`

## 2TB

Burgundy:
`100257267`

Silver:
`100257266`

Black:
`100257265`

Glacier:
`100257264`

Total:

16 variants

---

# 16. IPHONE 18 PRO MAX

Product code:

`MHDWHST-I18P1`

Market launch:

`2026-09-18T08:00:00+1000`

Known Telstra launch metadata:

around `2026-09-12T21:10:00+1000`

## 256GB

Burgundy:
`100257225`

Silver:
`100256806`

Black:
`100256805`

Glacier:
`100256804`

## 512GB

Burgundy:
`100257226`

Silver:
`100256812`

Black:
`100256811`

Glacier:
`100256810`

## 1TB

Burgundy:
`100257227`

Silver:
`100256818`

Black:
`100256817`

Glacier:
`100256816`

## 2TB

Burgundy:
`100257228`

Silver:
`100256824`

Black:
`100256823`

Glacier:
`100256822`

Total:

16 variants

---

# 17. IPHONE DUO

Product code:

`MHDWHST-IPDU`

Market launch:

`2026-10-23T08:00:00+1100`

Telstra launch:

`2026-10-16T23:00:00+1100`

Colours:

- Night Sky
- Star White

## 256GB

Night Sky:
`100257566`

Star White:
`100256913`

## 512GB

Night Sky:
`100257567`

Star White:
`100256895`

## 1TB

Night Sky:
`100257569`

Star White:
`100256907`

## 2TB

Night Sky:
`100257570`

Star White:
`100256901`

Total:

8 variants

---

# 18. TOTAL TRACKED VARIANTS

Total static fallback catalogue:

```text
16 iPhone 18 Pro
16 iPhone 18 Pro Max
8 iPhone Duo
= 40 variants
```

---

# 19. PRODUCT MODEL

Use something like:

```ts
interface ProductVariant {
  model: "iPhone 18 Pro" | "iPhone 18 Pro Max" | "iPhone Duo"
  storage: string
  colour: string
  sku: string
  productCode: string
  deviceName: string
  marketLaunchDate?: string
  telstraLaunchDate?: string
  imageUrl?: string
  merchandisingStatus?: string
  merchandisingMessage?: string
}
```

Do not expose Telstra page parsing logic to the UI.

---

# 20. SKU BATCHING

Do not assume all 40 SKUs can safely be included with 10 stores in one Telstra request.

Response size grows approximately with:

```text
number of SKUs × number of stores
```

Implement SKU batching.

Recommended initial batch size:

6-8 SKUs

Make configurable.

If Telstra returns HTTP 413:

1. reduce SKU batch size
2. retry only that batch
3. preserve successful earlier work

Never solve 413 by increasing store page size.

Query only SKUs relevant to current filters wherever possible.

Example:

If user selects:

```text
iPhone 18 Pro Max
512GB
Silver
```

only query:

```text
100256812
```

Do not query all 40.

---

# 21. CLOUDFLARE-SAFE STOCK PAGING

Prefer a route such as:

```text
POST /api/stock/page
```

Input:

```ts
{
  lat: number
  lon: number
  skus: string[]
  from: number
  size: 10
}
```

The Worker should:

1. validate request
2. batch SKUs safely
3. call Telstra for that single store page
4. merge the SKU batch responses for those stores
5. normalise results
6. return stores + stock + pagination metadata

The browser then calls:

```text
from=0
from=10
from=20
...
```

progressively.

This avoids one enormous Worker invocation.

---

# 22. RATE LIMITING / RESPONSIBLE USE

This is a personal utility.

Do not hammer Telstra.

Use:

- sequential upstream fetches or very limited concurrency
- 150-300 ms spacing where appropriate
- exponential backoff on transient failures
- up to 2 retries
- jitter
- server caching
- request deduplication
- no idle background polling

Never implement high-concurrency scraping.

---

# 23. CACHING

Use Cloudflare cache / Worker cache where appropriate.

Separate TTLs:

## Stock

15-30 seconds

## Geo lookup

hours/days

## Product metadata

15-60 minutes

Cache keys should account for:

- coordinates
- SKU set
- page/from
- relevant query parameters

Do not incorrectly reuse stock across different locations or SKU sets.

---

# 24. REQUEST COALESCING

If identical upstream work is already in progress, reuse it where feasible.

Avoid multiple identical Telstra calls from the same Worker instance/request path.

Do not create duplicate concurrent upstream calls unnecessarily.

---

# 25. PRIMARY MODE: FIND MY PHONE

The home screen should immediately answer:

“Where can I get the iPhone I want?”

Search controls:

Location:

```text
Suburb or postcode
```

Model:

```text
Any model
iPhone 18 Pro
iPhone 18 Pro Max
iPhone Duo
```

Storage:

dynamic based on model

Allow:

```text
Any storage
```

Colour:

dynamic based on model

Allow:

```text
Any colour
```

Radius:

```text
10 km
25 km
50 km
100 km
250 km
500 km
Australia-wide
```

Default:

50 km

State:

```text
Any
VIC
NSW
QLD
SA
WA
TAS
ACT
NT
```

Available only:

default ON

Primary CTA:

```text
Check stock
```

Secondary:

```text
Refresh
```

---

# 26. DEFAULTS

First-run defaults:

Location:

Port Melbourne VIC 3207

Model:

iPhone 18 Pro Max

Radius:

50 km

Available only:

ON

Storage:

Any

Colour:

Any

---

# 27. DISTANCE-BASED EARLY STOPPING

Telstra results appear to be ordered nearest-first.

Use this to speed local searches.

If the user selected:

50 km

and the page being returned has clearly moved beyond 50 km, stop requesting more pages.

Be conservative and only stop once the ordering makes it safe to do so.

Do not scan Australia if the user only wants nearby Melbourne stores.

Australia-wide should be explicit.

---

# 28. RESULTS SUMMARY

After scanning, show:

```text
6 stores have stock

42 Telstra stores checked
Within 50 km of Port Melbourne VIC

Updated 8:04:12 AM
```

If nothing is available:

```text
No stock found yet

42 Telstra stores checked
Last checked 8:04:12 AM
```

No-stock state is not an error state.

---

# 29. RESULTS DISPLAY

Sort:

1. available first
2. nearest first

Group multiple matching variants under a single store.

Example:

```text
CHADSTONE

13.6 km
Chadstone VIC 3148

AVAILABLE

iPhone 18 Pro Max
512GB • Silver

In store only

Open today until 9:00 PM

Call store
Directions
View store
```

If a store has multiple matching variants:

```text
TELSTRA CHADSTONE
13.6 km

4 matching variants available

iPhone 18 Pro Max
• 512GB Silver
• 512GB Black
• 1TB Silver
• 2TB Silver
```

Do not create duplicate store cards.

---

# 30. STORE INVENTORY MODE

This is a first-class feature.

Every store result should open a Store Inventory screen.

Header:

```text
Telstra Chadstone

Chadstone VIC 3148
13.6 km away

Open until 9:00 PM
Phone
Address
```

Then:

```text
LIVE IPHONE STOCK
```

Show every tracked SKU for that store.

Group by:

Model
→ storage
→ colour

Example:

```text
iPhone 18 Pro Max

256GB
✓ Black
✓ Silver
✕ Glacier
✕ Burgundy

512GB
✓ Silver
✕ Black
✕ Glacier
✕ Burgundy
```

Default:

Available only

Allow:

```text
Show unavailable
All SKUs
```

Display count:

```text
7 of 40 tracked variants available
```

---

# 31. QUERYING A SPECIFIC STORE

The Telstra stock endpoint is location-based, not direct store-code lookup.

For a selected store:

1. use the store’s own latitude/longitude
2. query all relevant SKU batches
3. use `size: 10`
4. inspect returned stores
5. match exact `storecode`
6. if needed continue pagination until that store is found
7. display only that selected store’s stock

Do not assume the selected store is always result index 0.

Always match exact storecode.

Because coordinates are the store’s own coordinates, it should normally appear immediately or very near the top.

---

# 32. STORE DIRECTORY

Include a Stores page.

Allow:

- search by store name
- suburb
- postcode
- state
- nearest stores
- favourite stores

Potential list:

```text
Port Melbourne
Melbourne Emporium
Melbourne Icon
Chadstone
Highpoint
Southland
...
```

Populate store data opportunistically from successful stock responses.

Persist useful store metadata locally in the browser if desired.

No database.

---

# 33. FAVOURITE TARGETS

Allow the user to save favourite search presets.

Example:

```text
My targets

iPhone 18 Pro Max
512GB Silver

iPhone 18 Pro
512GB Black
```

One tap runs a search.

Persist in localStorage.

---

# 34. BROAD SEARCH

Support:

```text
iPhone 18 Pro Max
Any storage
Any colour
```

and:

```text
iPhone 18 Pro Max
512GB
Any colour
```

Return exact matching configurations.

---

# 35. OPTIONAL MULTI-TARGET SEARCH

If practical, allow selecting multiple variants.

Example:

```text
512GB Silver
512GB Black
1TB Silver
```

Batch intelligently internally.

Do not expose SKU batching to the user.

---

# 36. CHANGE DETECTION

Persist prior successful scan state in localStorage.

Compare:

previous stock
vs
new stock

Detect:

```text
unavailable → available
```

Mark:

```text
NEW STOCK
```

Also detect:

```text
available → unavailable
```

but use a quieter visual treatment.

Add optional:

```text
Changed since last check
```

filter.

---

# 37. AUTO REFRESH

Provide:

```text
Off
30 seconds
60 seconds
2 minutes
5 minutes
```

Default OFF.

Never overlap scans.

If a new interval occurs while scanning:

skip that interval.

If tab is hidden:

pause or reduce scanning.

Resume when visible.

---

# 38. NOTIFICATIONS

Optional opt-in:

```text
Notify me when stock appears
```

Use browser notifications where supported.

Optional subtle alert sound.

Do not notify repeatedly for unchanged stock.

Notification example:

```text
NEW STOCK

iPhone 18 Pro Max
512GB Silver

Chadstone
13.6 km away
```

---

# 39. PROGRESSIVE RESULTS

The interface must not feel frozen.

Show progress:

```text
Checking Telstra stores…

30 stores checked
```

or:

```text
Checking stores 31-40…
```

For longer scans, display results progressively.

As soon as available stock is discovered:

show it.

Example:

```text
2 stores found so far…
Still checking…
```

Do not wait for the full scan.

---

# 40. LAUNCH-DAY EXPERIENCE

iPhone 18 Pro and Pro Max:

Launch:

18 September 2026 at 8:00 AM AEST

iPhone Duo:

Launch:

23 October 2026 at 8:00 AM AEDT

Show a release countdown/status where relevant.

Examples:

```text
iPhone 18 Pro Max
Launches Friday at 8:00 AM
```

or:

```text
iPhone Duo
Releases 23 October
```

Do not block stock queries before launch.

The RIMS endpoint already recognises unreleased/pre-order SKUs.

---

# 41. CATALOGUE STATUS VS REAL STORE STOCK

Do not confuse product-page status such as:

```text
preOrder
```

or merchandising messages with actual store inventory.

The stock endpoint is the source of truth for store-level inventory.

Product-page status may be shown separately as context.

---

# 42. OPENING HOURS

Use:

```text
hrs_mon
hrs_tue
hrs_wed
hrs_thu
hrs_fri
hrs_sat
hrs_sun
```

Display:

```text
Open today 9:00 AM – 9:00 PM
```

or:

```text
Closed today
```

Where feasible calculate:

```text
Open now
Closes 9:00 PM
Opens 9:00 AM
```

Use the store’s local Australian timezone where practical.

Handle malformed hours gracefully.

---

# 43. CALL STORE

Phone numbers should be clickable:

```text
tel:
```

On mobile:

Primary action:

```text
Call store
```

---

# 44. DIRECTIONS

Use store coordinates/address.

Provide:

```text
Directions
```

Open external maps.

Do not use a heavy embedded map as a core dependency.

---

# 45. DESIGN DIRECTION

This needs to look outstanding.

Design inspiration:

- Apple-level restraint
- premium typography
- large whitespace
- excellent hierarchy
- Telstra-inspired electric blue/purple/cyan accents
- original visual identity
- fast, native-feeling interactions

Use:

- white / near-white backgrounds
- charcoal / near-black text
- subtle greys
- green only for actual stock
- minimal red
- restrained borders
- minimal shadows
- intentional corner radii
- subtle micro-interactions

Do not make:

- generic SaaS admin dashboard
- endless card grid
- dense enterprise table UI
- oversized decorative animations

Respect:

`prefers-reduced-motion`

---

# 46. HOME SCREEN

Suggested structure:

Top nav:

```text
Stock Finder
Stores
Products
```

Optional right side:

```text
Last updated
Settings
```

Hero:

```text
Find your iPhone.

Live Telstra store availability across Australia.
```

Search surface:

```text
[ Port Melbourne VIC 3207 ]

[ iPhone 18 Pro Max ]
[ Any storage ]
[ Any colour ]

[ 50 km ]

[ Check stock ]
```

Below:

```text
AVAILABLE NEAR YOU
```

---

# 47. MOBILE UX

This app will likely be used while travelling between stores.

Mobile is critical.

Requirements:

- big touch targets
- compact store cards
- call button immediately accessible
- directions immediately accessible
- fast filter bottom sheet
- sticky refresh/check action allowed
- no horizontal scrolling
- no huge tables
- easy one-handed use
- Store Inventory screen must be excellent on mobile

---

# 48. DESKTOP UX

Desktop may be slightly denser.

Possible layouts:

Search header
→ results list
→ optional detail panel

or

Filters + results

Do not create a three-column enterprise dashboard.

Keep it focused.

---

# 49. PRODUCTS PAGE

Create a Products screen showing:

```text
iPhone 18 Pro
16 variants
Launch 18 Sep

iPhone 18 Pro Max
16 variants
Launch 18 Sep

iPhone Duo
8 variants
Launch 23 Oct
```

Product detail can show:

- storage
- colour
- SKU
- product code
- launch date
- source
- metadata refresh timestamp
- whether fallback is active

Keep implementation details out of the main stock search.

---

# 50. PRODUCT SOURCE HEALTH

Track:

```text
Last product metadata sync
Variants discovered
Fallback catalogue active
```

If auto-discovery fails:

continue using fallback silently.

Optionally surface a small warning in Settings.

Do not break search.

---

# 51. SETTINGS

Keep minimal.

Options:

- default location
- default radius
- favourite targets
- favourite stores
- auto refresh
- notifications
- show unavailable
- optionally theme

Light mode is primary.

Dark mode optional.

---

# 52. NORMALISED DATA MODELS

Use strict TypeScript.

Example:

```ts
interface Store {
  code: string
  name: string
  address: string
  suburb: string
  postcode: string
  state: string
  phone?: string
  email?: string
  latitude: number
  longitude: number
  distanceMetres: number
  hours?: Record<string, string>
}
```

Example:

```ts
interface StockResult {
  sku: string
  model: string
  storage: string
  colour: string
  status: string
  usageType: string
  store: Store
}
```

Use runtime validation where useful.

Zod is acceptable.

---

# 53. DEDUPLICATION

Deduplicate:

Products by SKU

Stores by storecode

Stock by:

```text
storecode + sku
```

Never show duplicated variants caused by repeated page markup.

---

# 54. SORTING

Default store order:

1. available
2. distance ascending

Variant storage order:

```text
256GB
512GB
1TB
2TB
```

Do not sort storage alphabetically.

Colour may sort consistently alphabetically or by catalogue order.

---

# 55. CLIENT-SIDE FILTERING

Once stock data is loaded, filters should feel instant.

Examples:

- available only
- model
- storage
- colour
- state
- changed since last scan

Do not refetch unnecessarily if fresh data already contains required results.

---

# 56. INTERNAL API SUGGESTION

Suggested endpoints:

```text
GET /api/products

GET /api/location?q=3207

POST /api/stock/page

GET /api/stores

POST /api/stores/:storeCode/inventory
```

Exact route shape may differ.

Keep Telstra-specific logic isolated.

Suggested structure:

```text
src/
  worker.ts

  lib/
    telstra/
      stock.ts
      geo.ts
      products.ts
      normalise.ts
      cache.ts
      types.ts

  data/
    products.ts
```

Frontend UI should not parse raw Telstra payloads.

---

# 57. HTTP 413 HANDLING

Known Telstra downstream error:

HTTP 413

Likely caused by request/response payload too large.

Production behaviour:

- store page size always 10
- reduce SKU batch size
- retry failed batch
- preserve successful earlier results
- do not restart entire scan unless required

---

# 58. RETRIES

For transient upstream errors:

- up to 2 retries
- exponential backoff
- jitter
- never infinite retry

Do not aggressively retry obvious bad-request errors.

---

# 59. PARTIAL RESULTS

If an upstream failure occurs mid-scan:

keep successful data.

Example:

```text
Partial results

70 stores checked before Telstra stopped responding.

Retry remaining stores
```

Never discard successful earlier pages.

---

# 60. ERROR UX

Do not expose stack traces.

Use calm error messages.

Example:

```text
Telstra didn’t respond for part of this scan.

Showing the results we successfully checked.
```

---

# 61. PERFORMANCE REQUIREMENTS

This website must feel extremely fast.

Optimise aggressively:

- minimal client JS
- route/code splitting
- no unnecessary heavy dependencies
- lazy-load secondary screens
- abort stale requests
- avoid duplicate scans
- instant client-side filtering
- cache intelligently
- precompute static catalogue fallback
- do not render giant hidden trees
- virtualise long lists only if genuinely needed
- optimise images
- keep bundle small
- fast mobile startup

Use browser performance tools and fix obvious bottlenecks.

---

# 62. PRODUCT IMAGE USAGE

Product metadata includes image paths.

Images may be used tastefully.

Do not make large imagery slow the primary search.

Prefer:

- small optimised product thumbnails
- lazy loading
- optional images in product detail screens

Stock visibility matters more than decorative imagery.

---

# 63. ACCESSIBILITY

Ensure:

- sufficient contrast
- keyboard navigation
- semantic controls
- visible focus states
- screen-reader labels
- colour is not the only availability indicator

Use:

```text
✓ Available
```

not only a green dot.

---

# 64. TESTS

Add meaningful automated tests for:

- pagination increments by 10
- scan stops on <10 stores
- size remains 10
- 413 reduces SKU batch size
- place.id → storecode join
- variant dedupe by SKU
- store dedupe by storecode
- stock dedupe by storecode+sku
- availability interpretation
- distance sorting
- storage order
- radius stopping
- change detection
- store inventory grouping
- product-page parser
- fallback catalogue activation
- geo result normalisation

---

# 65. LOGGING

Development logs should include:

```text
Telstra request
correlation ID
from
size
SKU count
status
duration
store count
stock record count
```

Do not dump massive payloads in production logs.

Do not expose internal logs to users.

---

# 66. README

Create a clear README covering:

- project purpose
- architecture
- stack
- Cloudflare deployment
- Wrangler commands
- local development
- upstream Telstra endpoints
- known API behaviour
- SKU fallback catalogue
- cache behaviour
- free-tier considerations
- how to add another product later
- how to update fallback SKUs
- how to test

---

# 67. WRANGLER / CLOUDFLARE CONFIG

Provide complete deployment configuration.

Include:

- wrangler config
- build command
- static asset binding/config
- Worker entry
- route handling
- dev command
- deployment command

The project should be deployable with something like:

```text
npm install
npm run dev
npm run build
npx wrangler deploy
```

Adjust exact commands as needed.

Do not leave Cloudflare setup half-finished.

---

# 68. FIRST IMPLEMENTATION PRIORITY

Build in this order:

1. static fallback product catalogue
2. Telstra stock Worker integration
3. one-page stock query
4. pagination
5. normalisation
6. SKU batching
7. 413 fallback
8. geo search
9. primary stock finder UI
10. radius stopping
11. grouped results
12. Store Inventory view
13. product-page auto-discovery
14. local favourites
15. change detection
16. auto refresh
17. notifications
18. Products page
19. store directory
20. final performance + visual polish
21. tests
22. Cloudflare deployment docs

Do not spend excessive time on secondary settings before the core stock flow works.

---

# 69. ACCEPTANCE CRITERIA

The app is complete when I can:

1. open the site
2. type Port Melbourne or 3207
3. select iPhone 18 Pro Max
4. select 512GB
5. select Silver
6. press Check Stock
7. see nearest Telstra stores with actual live availability
8. see distance, suburb, postcode, phone and hours
9. call the store
10. open directions
11. open a specific store
12. see exactly which tracked iPhone SKUs that store has
13. toggle available-only/all SKUs
14. refresh stock
15. detect newly available stock
16. optionally auto-refresh
17. receive notifications after opting in
18. use it comfortably on mobile
19. deploy it to Cloudflare without any external database

---

# 70. FINAL DESIGN STANDARD

Do not settle for a developer prototype.

After functionality works, perform a dedicated visual-polish pass.

Review:

- typography
- spacing
- density
- hierarchy
- empty states
- loading states
- progress states
- stock-found state
- filter UX
- mobile one-handed usability
- desktop layout
- button hierarchy
- animation
- responsiveness
- product grouping
- store grouping
- launch countdowns

The result should feel:

- fast
- premium
- calm
- precise
- exciting
- trustworthy
- launch-day ready

The core moment should feel excellent:

```text
FOUND IT

iPhone 18 Pro Max
512GB Silver

Port Melbourne
0.3 km away

Available in store

Call store
Directions
View all stock at this store
```

That interaction should be the emotional centre of the product.

---

# 71. CODING EXPECTATION

Implement this entire application end to end.

Do not merely explain what to build.

Do not stop at scaffolding.

Do not leave TODOs for core functionality.

Create the files.

Implement the Worker.

Implement the frontend.

Implement the Telstra integrations.

Implement parsing.

Implement caching.

Implement batching.

Implement pagination.

Implement change detection.

Implement Store Inventory.

Implement tests.

Run the build.

Run the tests.

Fix errors.

Perform a visual polish pass.

Leave the project in a state where it can be deployed to Cloudflare immediately.

Make sensible engineering decisions without asking unnecessary questions.

Prioritise correctness, reliability, performance and a beautiful launch-day experience.