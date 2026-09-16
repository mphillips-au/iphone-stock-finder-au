# Current handoff

Updated 2026-09-16, approximately 17:20 Australia/Sydney.

## Status
First complete implementation built. Phases 0–6 implemented, with automated regression checks and live browser smoke tests passing. No public deployment. See TASKS.md for optional follow-ups. Do not rebuild from scratch.

## Session update — Products page redesign
Rebuilt the Products screen (`src/pages/Products.tsx`, `src/imageStyles.css`, `src/data/products.ts`) to closely match the Telstra iPhone 18 Pro/Pro Max/Duo product-page layouts supplied in `docs/*Layout.png`: a bordered left card (Apple/model name, "iPhone 18 range" pill linking to the live Telstra product page, colour swatch circles, capacity pill buttons, a launch/availability info box, a primary CTA) beside a right-hand device image with colour thumbnails and a page number, per model. The colour swatches and capacity buttons are interactive (switch the shown SKU/image); the CTA ("Check stock near me") sets Home filters to that exact model/storage/colour and runs a live scan — this is new functional wiring in `App.tsx` (`onCheck` prop), not just visual. Colour hex values added as `COLOUR_SWATCHES` in `src/data/products.ts` (approximate, cosmetic only). Removed the old `.product-*` CSS rules (unused after the rewrite) and replaced `imageStyles.css` with new `.tel-*` rules including a `900px`/`600px` responsive stack matching the rest of the app's breakpoints.
Images use the existing Telstra `imageUrl` per variant with a graceful onError fallback to the original placeholder box (tested by simulating a network-blocked image load); real Telstra hotlinked images were not re-verified live this session (no outbound network in this container) — the underlying `imageUrl` plumbing was already verified working in an earlier session per the entries below.
Verified this session: `npm run check`, `npm test` (25 passed), `npm run build`, `npm run deploy:check` all pass. Visual check done via a local Vite dev server + headless Chromium screenshots at desktop (1400px) and mobile (390px) widths — layout, swatch/capacity interaction and responsive stacking confirmed; device images render as the placeholder box in this sandboxed check since outbound network is unavailable here.

## Session update — Sound alerts
Added an opt-in "Play a sound too" toggle next to the existing OS-notification toggle in the Find page's monitor panel (`src/App.tsx`). When enabled, a short Web Audio beep plays for each newly-seen available stock key (same `scan.diff`/`stockKey` change-detection already used for notifications and the "changed since last check" filter), deduped per check via a `chimed` ref cleared alongside the existing `notified` ref in `check()`. No new dependencies; wrapped in try/catch since `AudioContext` can be blocked before a user gesture in some browsers — visual highlighting of new stock still works either way. `npm run check`/`npm test`/`npm run build` all pass; actual audible playback was not device-tested this session (no audio output in this sandbox), consistent with the existing notification permission caveat in Verification limits below.

## Session update — Dark mode
Introduced semantic CSS custom properties (`--bg`, `--surface`, `--surface-alt`, `--text`, `--muted`/`--muted-2`, `--line`/`--border`, `--blue`/`--blue-hover`/`--blue-tint`/`--blue-border`, `--selection`, `--green`/`--green-tint`, `--chip-bg`, `--placeholder`, `--shadow-1/2/3`) in `src/styles.css`, replacing essentially every hardcoded hex colour across `styles.css` and `imageStyles.css` with `var(...)`. Dark values are supplied two ways: `@media(prefers-color-scheme:dark)` for users who haven't chosen (auto-follows OS), and `:root[data-theme=dark]`/`[data-theme=light]` for an explicit override. Added a moon/sun toggle button in the header (`src/App.tsx`, `.theme-toggle`) that flips the *effective* current appearance and persists the explicit choice via `writeLocal('theme', …)`; before any explicit choice the app silently follows the OS preference. Product photos on the Products page sit on a small literal-white "photo mat" (`.tel-photo`) regardless of theme, since the Telstra hero PNGs assume a white backdrop — this was a deliberate exception to the semantic-token rule.
Verified this session: `npm run check`, `npm test` (25 passed), `npm run build`, `npm run deploy:check` all pass. Visually checked light and dark via local Vite dev server + headless Chromium screenshots (Find page and Products page) — contrast, toggle behaviour and the Products card/photo-mat readability all confirmed acceptable in both themes.

## Verified
- Type check passed (also included in build).
- npm test: 25 passed on Vitest 4.1.11.
- npm run build: passed; primary JS about 78 KB gzip; lazy secondary routes.
- npm run deploy:check: passed; one Worker/static-assets project, no database.
- npm install/audit after patched Vitest: zero vulnerabilities.
- Live stock and postcode probes returned HTTP 200. Historical fixtures: docs/stock-probe.json and docs/geo-probe.json; never production stock.
- Browser → local Worker → Telstra live scan of Pro Max 512GB Silver: offsets 0,10,…,50; 36 stores within 50 km, none available at test time. Radius stopped after two entirely out-of-radius pages.
- Store inventory: exact Port Melbourne code ABQW, all 40 configurations checked via batches. All unavailable at test time. All-SKUs toggle and mobile grouping verified.
- Postcode 3207 autocomplete, keyboard ArrowDown/Enter selection, saved target, persisted directory/preferences, phone/maps links, desktop layout and 390px mobile layout verified.
- Partial error/retry exercised while fixing runtime issues, then recovered into a complete live search.
- Telstra product image support added: variant image fields plus page metadata are parsed server-side; Products renders lazy HTTPS images with a safe placeholder. Product discovery now follows page redirects and accepts both common metadata attribute orders. Image parser coverage is included in the 25 passing tests.
- Verified Telstra-hosted hero assets are assigned to all 40 fallback variants, so the local `/api/products` response reports 40 image URLs even when live product discovery is unavailable. The Worker product cache key was bumped to invalidate older placeholder-only responses.
- Hidden-tab scan pause/resume is implemented through the Page Visibility API; device-level background refresh and notification delivery remain untested.
- The final image-rendering browser reload was blocked by the app's usage-limit auto-review. Static checks and the local product endpoint confirm image URLs are now present; recheck the Products screen in the next available local browser session.

## Next action
Review desired UX changes or deploy when requested. Before public deployment, log into Cloudflare, run the four checks in AGENTS.md, then npm run deploy with explicit authorization. No account/domain selected.

## Verification limits
- Actual OS notification delivery, geolocation permission UX and timed background-tab refresh were not exercised; implementation exists and stock transitions are unit-tested. Do not claim cross-browser/iOS notification support was tested.
- No live available-stock state existed during testing; positive transitions use fixtures.
- Public Cloudflare-edge execution has not been tested; local workerd and packaging passed.
- State timezone mapping may differ in border towns; upstream hours are not holiday guarantees.
- Radius stopping depends on observed ordering; disorder disables the optimisation.
- Product discovery falls back if pages fail or markup changes; Products reports source health.
- A public GitHub repository and initial commit are still the final external handoff step for this session.

## Environment
Use PowerShell: & 'C:/Program Files/nodejs/npm.cmd' <command>. Bare npm.ps1 resolves incorrectly here. Dependencies and lockfile exist; do not reinstall unnecessarily.

For restricted-agent Wrangler sessions:
```powershell
$env:XDG_CONFIG_HOME = 'D:/iPhone-Stock-Finder-AU/.wrangler/config'
$env:WRANGLER_LOG_PATH = 'D:/iPhone-Stock-Finder-AU/.wrangler/logs'
$env:WRANGLER_SEND_METRICS = 'false'
& 'C:/Program Files/nodejs/npm.cmd' run preview
```
Local preview started at http://127.0.0.1:8787 (exec session 36031); may require restart in later sessions. .dev.vars enables compact upstream diagnostics locally and is ignored; production logging defaults off. Live checks require allowed network access.

The user explicitly approved sending the prompt's sample Port Melbourne coordinates, SKU 100256812 and postcode 3207 to the specified Telstra APIs. Do not ask for that same approval again.

## Implementation facts
- Geo shape: results[].centrePoint and address.
- Default fetch transport wraps global fetch to avoid illegal this binding. Redirect mode manual: workerd rejects error. Keep Worker smoke tests; Node tests alone missed these differences.
- Routes: products, location and one-page stock. Browser directory and inventory reuse stock paging; no server stores database.
- Failed SKU batches remain unknown; successful work is preserved. No fake production inventory.
- Rebuilding while a tab has old lazy chunks open requires reload; recovery boundary handles chunk failures.

## Continue with any assistant
Read AGENTS.md, HANDOFF.md and TASKS.md. Continue the first incomplete phase or remaining verification item. Preserve existing work, verify changes and update both progress files before stopping. Read only relevant master-prompt sections.
