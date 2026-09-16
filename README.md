# Stock Finder AU

A personal, unofficial iPhone launch-day utility: find matching configurations at nearby Telstra stores and inspect a specific store's tracked inventory. React, Vite and strict TypeScript, served by one Cloudflare Worker with static assets and a D1 database. No accounts, no per-visitor Telstra traffic — see "Background indexer" below.

Production: https://iphone-stock-finder-au.mphillips-au.workers.dev

## Run locally

Use Node 22.12+ or a compatible newer release.

```sh
npm ci
npm run build
npm run preview
```

Open http://127.0.0.1:8787. For frontend hot reload, run `npm run dev:api` and `npm run dev` in separate terminals; Vite proxies `/api` to port 8787. Build once before starting Wrangler so `dist` exists.

On this Windows machine, bare `npm` is broken; use `& 'C:/Program Files/nodejs/npm.cmd' run build` (and the same prefix for other npm commands). In a restricted agent sandbox, Wrangler can use project-local temporary files:

```powershell
$env:XDG_CONFIG_HOME = 'D:/iPhone-Stock-Finder-AU/.wrangler/config'
$env:WRANGLER_LOG_PATH = 'D:/iPhone-Stock-Finder-AU/.wrangler/logs'
$env:WRANGLER_SEND_METRICS = 'false'
& 'C:/Program Files/nodejs/npm.cmd' run preview
```

These variables affect only the current process/session. Live requests require network access.

## Work across Codex, Claude Code and Cursor

Read `AGENTS.md`, `HANDOFF.md`, then `TASKS.md`. Claude's `CLAUDE.md` and Cursor's `.cursor/rules/project.mdc` point to these same files. Use one assistant at a time in this folder. No conversation export is needed.

Paste this into the next assistant:

> Read AGENTS.md, HANDOFF.md and TASKS.md. Continue the first incomplete phase, implement and verify it, and update both progress files before stopping. Preserve existing work and use the master prompt for requirements.

## Architecture

Browser → same-origin Worker API → D1 snapshot (visitor traffic never reaches Telstra) → normalised results. A Cloudflare Cron Trigger separately runs `src/lib/telstra/indexer.ts`, which is the only thing that talks to Telstra live. Only `src/lib/telstra` handles upstream formats. `src/shared` contains domain logic and types. `src/client/useScan.ts` orchestrates progressive pages and partial retries against the snapshot. Secondary screens (Products, Stores, Inventory, the Leaflet map) are lazy-loaded.

- `GET /api/products`: discovery from the three configured product pages plus fallback catalogue.
- `GET /api/location?q=3207`: debounced suburb/postcode lookup.
- `POST /api/stock/page`: `{lat, lon, skus, from, size:10}`; one page of the nationwide D1 snapshot, nearest-first. Falls back to a live Telstra lookup only if D1 has never been populated (e.g. before the first cron cycle after a fresh deploy). `skus` must be a subset of `TRACKED_SKUS` (`src/data/products.ts`) — the indexer and the read API only ever know about this app's own 40 tracked configurations, never an arbitrary/open-ended SKU list.
- `GET /api/status`: indexing health (`storeCount`, `oldestUpdate`, `lastFullCycleAt`) for the "last updated" badge in the header.
- Store inventory uses the same paged API at the store coordinates and matches exact store code.
- Store directory accumulates in browser localStorage (recently viewed + favourites); the full nationwide store list lives in D1, not in the browser.

## Background indexer

`scheduled()` in `src/worker.ts` fires every 15 minutes (`triggers.crons` in `wrangler.jsonc`) and calls `runIndexCycle` (`src/lib/telstra/indexer.ts`), which advances a persisted cursor (`sync_state` table) through Telstra's store list, paging from a single fixed seed point (distance-ordered pagination is exhaustive — page deep enough from any one point and every store nationwide eventually appears, furthest last, so no grid of regional seed points is needed). Each cron tick only spends its usual live-request budget (`http.ts`'s 40-attempt cap, same one live scans use), so a full nationwide cycle is naturally staggered across several ticks rather than hitting Telstra all at once — this is also what keeps a busy site from ever causing Telstra rate limits or blocks: Telstra only ever hears from this one cron job, never from visitor traffic. Results upsert into D1's `stores`/`stock` tables (schema: `migrations/0001_init.sql`); `/api/stock/page` and `/api/status` just read that snapshot.

First-time D1 setup (one-off, needs your own Cloudflare account):

```sh
npx wrangler d1 create iphone-stock-finder-au-db
# paste the returned database_id into wrangler.jsonc's d1_databases entry
npx wrangler d1 execute iphone-stock-finder-au-db --local --file=migrations/0001_init.sql   # for local dev
npx wrangler d1 execute iphone-stock-finder-au-db --remote --file=migrations/0001_init.sql  # before first deploy
```

Cron Triggers and D1 are both available on Cloudflare's free plan at this app's scale (one seed point, 40 tracked SKUs, a few hundred stores). Cron doesn't fire in `wrangler dev`; trigger a slice manually with `curl http://localhost:8787/cdn-cgi/local/scheduled`.

## Map

The Find page's results include a small Leaflet map (`src/components/StoreMap.tsx`, lazy-loaded) using OpenStreetMap's tile server — free, no API key, no billing account. Geolocation stays on the browser's native `navigator.geolocation`, also free and already used for the "use my location" button.

## Telstra integration

Stock: `POST https://prod.okapi.ogw.evolve.okapi.telstra.com/tcom-ext/v1/stock/check`.

Geo: `POST https://prod.okapi.ogw.evolve.okapi.telstra.com/tcom-ext/v1/geo/unstructured`, with `source: tcom`.

Every stock request uses size 10, offsets in steps of 10, and a fresh UUID correlation ID. SKU batches default to 6 (configurable from 1–8 through `SKU_BATCH_SIZE`). A 413 splits only its failing batch. Requests are sequential with 180ms spacing, 10-second timeouts, jittered backoff and at most two transient retries. There is a hard 40-attempt budget per stock invocation; unresolved work is returned as partial and retried by the browser.

Availability requires status exactly `available`. Unknown/missing stock is never turned into unavailable. Stock joins `place.id` to exact `storecode`. Deduplication keys are SKU, storecode, and storecode+SKU respectively. Radius stopping requires two fully out-of-radius pages with monotonic observed distances; detected disorder disables it. This remains dependent on Telstra's distance ordering, which is not a contractual guarantee.

Successful batches/pages remain visible on failure. Retry sends only failed SKUs at the current offset, then resumes normal paging. A store-order mismatch forces a full current-page retry.

## Cache and limits

Cloudflare Cache API TTLs: snapshot stock pages 60 seconds; live-fallback stock 20 seconds; status 30 seconds; geo 24 hours; catalogue 30 minutes. Stock keys include exact coordinates, sorted unique SKU set, offset and size. Partial stock responses and empty geo lookups are not cached. Identical in-flight work coalesces within a Worker isolate; this is not a global rate limiter. Cache availability and coalescing across isolates are best-effort.

Auto-refresh is off initially, never overlaps a scan, skips hidden tabs, and resumes on a subsequent visible interval. Partial scans require explicit retry. Browser notifications require opt-in and an actual observed unavailable→available transition. Mobile browser support varies; no push service or service worker is used. Stock and preferences remain on this device. Geolocation runs only after a click.

Visitor traffic reads D1 and the edge cache only — it no longer calls Telstra directly, so a busy site can't trigger Telstra-side rate limits or blocks. It can still consume Cloudflare's own (generous free-tier) Workers/D1 quotas at high traffic, same as any Cloudflare app.

## Catalogue maintenance

`src/data/products.ts` contains all 40 user-supplied fallback SKUs and release dates. Treat these as supplied catalogue data rather than independent launch-date confirmation. Product-page discovery decodes `data-mobile-variant`, deduplicates by SKU and enriches fallback data. Images use verified Telstra-hosted hero assets immediately, then live variant image fields or page `og:image`/`image_src` metadata can refine them; relative URLs resolve against the Telstra product page, only HTTPS URLs are rendered, and a local neutral placeholder remains the final fallback. Source health is visible on Products. Product merchandising status never determines store inventory.

To update SKUs, edit the storage/colour matrices and verify model totals and the exact 512GB Silver target test. To add another product, extend the Model type, MODELS, PRODUCT_PAGES and fallback data, then update tests. Keep storage ordered numerically, not alphabetically.

## Test and deploy

```sh
npm run check
npm test
npm run build
npm run deploy:check
```

Tests cover captured Telstra responses, normalisation, joins, deduplication, pagination, 413 handling, budget/retries, partial preservation, geo, parser fallback, radius rules, sorting, changes, inventory grouping, cache coalescing, and the indexer/snapshot pair (staggered cursor resumption, nearest-first D1 reads, tracked-SKU restriction) against an in-memory D1 fake. Captures in `docs/*-probe.json` are historical fixtures, never served as live results.

After authorising public deployment, authenticate to your Cloudflare account, create and migrate the D1 database (one-off, see "Background indexer" above), then deploy:

```sh
npx wrangler login
npx wrangler d1 create iphone-stock-finder-au-db   # skip if it already exists; update wrangler.jsonc's database_id
npx wrangler d1 execute iphone-stock-finder-au-db --remote --file=migrations/0001_init.sql
npm run deploy
```

`wrangler.jsonc` includes the Worker entry, static asset binding, SPA fallback, `/api/*` Worker-first routing, the D1 binding and the cron trigger. No secrets are currently required. Production was deployed with Wrangler on 2026-09-16; GitHub automatic deployments are not configured. Cloudflare's [static assets](https://developers.cloudflare.com/workers/static-assets/), [D1](https://developers.cloudflare.com/d1/) and [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) documentation describe this setup.

## Known practical limits

Opening hours use state-based Australian timezones; border towns and special holiday hours may differ. Call before travelling. Metadata discovery tolerates page failures but future upstream markup/schema changes may require parser updates. Runtime live verification and remaining checks are recorded in HANDOFF.md rather than assumed here.
