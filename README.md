# Stock Finder AU

A personal, unofficial iPhone launch-day utility: find matching configurations at nearby Telstra stores and inspect a specific store's tracked inventory. React, Vite and strict TypeScript, served by one Cloudflare Worker with static assets. No accounts or database.

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

Browser → same-origin Worker API → Telstra → normalised results. Only `src/lib/telstra` handles upstream formats. `src/shared` contains domain logic and types. `src/client/useScan.ts` orchestrates progressive pages and partial retries. Secondary screens are lazy-loaded.

- `GET /api/products`: discovery from the three configured product pages plus fallback catalogue.
- `GET /api/location?q=3207`: debounced suburb/postcode lookup.
- `POST /api/stock/page`: `{lat, lon, skus, from, size:10}`; one store page only.
- Store inventory uses the same paged API at the store coordinates and matches exact store code.
- Store directory accumulates in browser localStorage. There is intentionally no server-side `/api/stores` database.

## Telstra integration

Stock: `POST https://prod.okapi.ogw.evolve.okapi.telstra.com/tcom-ext/v1/stock/check`.

Geo: `POST https://prod.okapi.ogw.evolve.okapi.telstra.com/tcom-ext/v1/geo/unstructured`, with `source: tcom`.

Every stock request uses size 10, offsets in steps of 10, and a fresh UUID correlation ID. SKU batches default to 6 (configurable from 1–8 through `SKU_BATCH_SIZE`). A 413 splits only its failing batch. Requests are sequential with 180ms spacing, 10-second timeouts, jittered backoff and at most two transient retries. There is a hard 40-attempt budget per stock invocation; unresolved work is returned as partial and retried by the browser.

Availability requires status exactly `available`. Unknown/missing stock is never turned into unavailable. Stock joins `place.id` to exact `storecode`. Deduplication keys are SKU, storecode, and storecode+SKU respectively. Radius stopping requires two fully out-of-radius pages with monotonic observed distances; detected disorder disables it. This remains dependent on Telstra's distance ordering, which is not a contractual guarantee.

Successful batches/pages remain visible on failure. Retry sends only failed SKUs at the current offset, then resumes normal paging. A store-order mismatch forces a full current-page retry.

## Cache and limits

Cloudflare Cache API TTLs: stock 20 seconds; geo 24 hours; catalogue 30 minutes. Stock keys include exact coordinates, sorted unique SKU set, offset and size. Partial stock responses and empty geo lookups are not cached. Identical in-flight work coalesces within a Worker isolate; this is not a global rate limiter. Cache availability and coalescing across isolates are best-effort. No KV, D1 or external database is required.

Auto-refresh is off initially, never overlaps a scan, skips hidden tabs, and resumes on a subsequent visible interval. Partial scans require explicit retry. Browser notifications require opt-in and an actual observed unavailable→available transition. Mobile browser support varies; no push service or service worker is used. Stock and preferences remain on this device. Geolocation runs only after a click.

Public traffic can still consume Cloudflare quotas: this is designed as a personal utility, not a multi-user scraping service.

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

Tests cover captured Telstra responses, normalisation, joins, deduplication, pagination, 413 handling, budget/retries, partial preservation, geo, parser fallback, radius rules, sorting, changes, inventory grouping and cache coalescing. Captures in `docs/*-probe.json` are historical fixtures, never served as live results.

After authorising public deployment, authenticate to your Cloudflare account and deploy:

```sh
npx wrangler login
npm run deploy
```

`wrangler.jsonc` includes the Worker entry, static asset binding, SPA fallback and `/api/*` Worker-first routing. No secrets are currently required. Deployment has not been performed automatically. Cloudflare's [static assets documentation](https://developers.cloudflare.com/workers/static-assets/) describes this single-project setup.

## Known practical limits

Opening hours use state-based Australian timezones; border towns and special holiday hours may differ. Call before travelling. Metadata discovery tolerates page failures but future upstream markup/schema changes may require parser updates. Runtime live verification and remaining checks are recorded in HANDOFF.md rather than assumed here.
