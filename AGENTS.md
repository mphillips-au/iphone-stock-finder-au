# Shared agent rules

## Start here (Codex, Claude Code, Cursor)
Read this file, `HANDOFF.md`, and `TASKS.md` first. Read only the relevant master-prompt sections and source files next. The full specification is `Master Codex Prompt_ Cloudflare iPhone Stock Finder.md`.

## Work and token discipline
- Work on the first unchecked, unblocked task in dependency order. Finish a testable slice before expanding scope.
- Keep TASKS.md accurate: `[ ]` pending, `[x]` verified complete. Record in-progress work in HANDOFF.md, never as completed.
- At every phase boundary and before stopping, update HANDOFF.md with current state, exact next action, files changed, commands/results, and blockers. Do not rely on conversation history.
- Keep handoff short and replace stale status. Preserve decisions in docs/DECISIONS.md.
- Use targeted searches and bounded output. Do not reread the entire specification or dependencies every session.
- Do not spawn agents unless the user explicitly requests them. One editor at a time in this checkout.
- Never claim tests, live integration, deployment, or UI checks passed without running them. Distinguish fixture tests from real upstream verification.
- Preserve user changes. Do not reset, clean, discard, or overwrite unrelated work. No secrets in source or logs.
- Do not deploy publicly, incur costs, or send messages without user authorization. Local builds and tests are authorized.

## Non-negotiable architecture
- React + Vite + strict TypeScript; one Cloudflare Worker with static assets and one D1 database (`DB` binding). No authentication, no traditional server.
- Browser calls only `/api/*`. Visitor requests never call Telstra directly — `/api/stock/page` and `/api/status` read the nationwide D1 snapshot. Only the cron-triggered indexer (`src/lib/telstra/indexer.ts`, invoked from `scheduled()` in `src/worker.ts`) calls Telstra live. This is deliberate: it's what keeps a busy site from ever causing Telstra-side rate limits or blocks, since Telstra only ever hears from our own cron job. `stockPage`/live-Telstra calls remain as the indexer's implementation and as a short-lived fallback for `/api/stock/page` before D1 has ever been populated (e.g. right after a fresh deploy, before the first cron tick) — never as the normal per-visitor path.
- The indexer only ever queries Telstra for `TRACKED_SKUS` (`src/data/products.ts`, this app's own fixed 40-SKU catalogue) — never an arbitrary/open-ended SKU list. `validatePage` in `src/worker.ts` rejects any requested SKU outside that set.
- Indexing is staggered, not a single burst: each cron tick (`triggers.crons`, every 15 minutes) advances a persisted cursor by one budget-bounded slice (same request budget live scans use — see `http.ts`), so a full nationwide cycle spans several ticks. Distance-ordered pagination from one fixed seed point is exhaustive on its own (deep-enough paging reaches every store nationwide, furthest last) — do not add a grid of regional seed points, it's unnecessary complexity for the same coverage.
- Stock requests always use `size: 10`, offsets in multiples of 10, sequential bounded SKU batches, and bounded retries.
- One store page per Worker request. Budget every upstream attempt (including 413 splits and retries) below free-tier subrequest limits.
- Exact stock status `available` is available. Missing/error/unknown stock is UNKNOWN, never silently unavailable.
- Join stock place.id to exact storecode; dedupe products by SKU and stock by storecode+SKU.
- Preserve successful pages/batches on failure and permit continuation. Never report a partial scan as complete.
- Store inventory matches exact storecode, never array position. Pagination remains browser-orchestrated (now over the D1 snapshot, not live Telstra).
- Cache by coordinates, sorted SKU set, offset and relevant parameters. The client polls only the tiny `/api/status` endpoint (never Telstra) for the "last updated" badge, paused when hidden; auto-refresh of the stock scan itself defaults off and still pauses when hidden.
- Treat all upstream data as untrusted; validate inputs and tolerate schema drift without inventing stock.
- Fallback SKUs and launch dates are supplied by the master prompt, not independently verified product facts.
- Map: Leaflet + OpenStreetMap tiles only (free, no API key, no billing account). Geolocation stays on the browser's native `navigator.geolocation`. Do not introduce a paid or key-gated maps/geocoding provider.

## Design context
Personal Australian launch-day utility used on phones while travelling between stores. Primary jobs: find an exact phone nearby and inspect every tracked SKU at one store. Calm, premium, precise, fast; near-white surfaces, charcoal text, restrained electric blue accents, green only for real available stock. Original identity and clear unofficial footer. Mobile, keyboard accessibility, truthful progress/error/empty states matter more than decoration.

## Verification
Run `npm run check`, `npm test`, `npm run build`, and `npm run deploy:check` before marking final readiness. Add regression tests for nontrivial stock/data behavior. Review mobile and desktop UI. Record environmental failures with exact commands and recovery steps. No TODO or mocked inventory in production paths.
