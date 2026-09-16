# Build checklist

Check a task only after its acceptance check passes. Runtime evidence goes in HANDOFF.md. Optional scope is identified explicitly.

## Phase 0 — Portable working agreement
- [x] Read master prompt and inventory repository.
- [x] Shared AGENTS.md, Claude/Cursor entry points, phased checklist, handoff and decisions.
- [x] Runnable package tooling, strict TypeScript and Cloudflare configuration.

## Phase 1 — Catalogue and upstream contract
- [x] All 40 supplied fallback variants, stable types and correct storage ordering.
- [x] Stock normalisation: exact store join, deduplication, unknown status, distance and hours.
- [x] Live stock and geo probes; capture actual response shape or document access blocker.
- [x] Tests for catalogue integrity, normalisation and availability.

## Phase 2 — Resilient Worker API
- [x] One-page API validation, sequential SKU batching and 413 splitting.
- [x] Bounded retries, timeout, request budget, spacing and safe logging.
- [x] Partial-batch preservation and retry only missing SKUs.
- [x] Stock/geo/product caching and request coalescing.
- [x] Geo normalisation and product discovery with safe fallback.
- [x] Worker contract and failure-path tests.

## Phase 3 — Find my phone
- [x] Location autocomplete, geolocation on click and specified defaults.
- [x] Model/storage/colour/radius/state filters; exact relevant SKU queries.
- [x] Progressive pagination, cancellation, retry continuation and conservative radius stopping.
- [x] Grouped available/nearest results, honest freshness, phone, directions and hours.
- [x] Premium responsive UI, accessible controls and loading/empty/error states.

## Phase 4 — Store and product workflows
- [x] Exact-code store inventory, full catalogue, grouped model/storage/colour and unknown states.
- [x] Store directory, search, state filter and favourites.
- [x] Lazy Products screen, metadata health, sources and launch context.

## Phase 5 — Personal launch-day tools
- [x] Versioned resilient local persistence; favourite targets and stores.
- [x] Scoped change detection and changed-only filter; partial scans cannot erase known state.
- [ ] Optional refresh intervals and no overlap; hidden-tab pause still needs device verification/final check.
- [x] Opt-in notifications for newly available stock, no repeated unchanged alerts.

## Phase 6 — Release verification and handoff
- [x] Required behavior regression tests pass.
- [x] Type check, production build and Wrangler dry-run pass.
- [x] Live upstream end-to-end check or precise externally blocked status.
- [x] Desktop/mobile visual and keyboard checks; fix observed issues.
- [x] README: setup, architecture, cache, limits, maintenance and Cloudflare deploy.
- [x] Final accurate HANDOFF.md with remaining limitations and deploy steps.

## Optional after v1
- [ ] Device QA: actual notification delivery, geolocation permission paths and timed hidden-tab refresh (implemented, not manually exercised).
- [ ] Verify a real available-stock result when launch-day stock exists (fixture behavior tested).
- [x] Pull Telstra product images into the Products screen with safe fallback behavior.
- [x] Products screen: fix Telstra fidelity (drop range link, dedupe colour pickers, real photo gallery, drop SKU listing), live "N of 10 nearest stores" badge, image skeleton/fade-in.
- [x] Multi-select colours/storage in the main filter (scans every selected combination at once).
- [x] Sound alerts.
- [x] Dark mode.
- [x] Public deployment authorized and verified 2026-09-16: https://iphone-stock-finder-au.mphillips-au.workers.dev (live scan and desktop/mobile smoke checks).
- [x] Background nationwide indexer (Cloudflare Cron Trigger + D1) so visitor traffic reads a shared snapshot instead of calling Telstra live; staggered cursor, tracked-SKUs-only. `/api/stock/page` falls back to live Telstra only before the first cron cycle populates D1.
- [x] "Last updated" badge (`/api/status`, polled client-side, never hits Telstra).
- [x] Free store map (Leaflet + OpenStreetMap tiles, lazy-loaded) on the Find results.
- [x] Real Cloudflare D1 database created and migrated 2026-09-16 (`iphone-stock-finder-au-db`, region OC, id `df44669c-d450-4234-9334-045ae74e7629`, wired into `wrangler.jsonc`; schema applied with `--remote`).
- [ ] Verify the cron trigger actually fires on Cloudflare's schedule in production (only exercised locally via the manual `/cdn-cgi/local/scheduled` trigger this session — see HANDOFF.md).
- [ ] Optional: delete/retire D1 store rows Telstra no longer returns (indexer currently only upserts, never removes a closed store).
- [x] Verified live against real telstra.com.au (2026-09-16): Telstra's product-page JSON does carry a genuine multi-image gallery, distinct per colour. Found and fixed a real bug in the process — Telstra 403s the product-page fetch when no User-Agent is sent, so production was silently stuck on the fallback catalogue; see HANDOFF.md.

