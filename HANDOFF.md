# Current handoff

Updated 2026-09-16, approximately 16:55 Australia/Sydney.

## Status
First complete implementation built. Phases 0–6 implemented, with automated regression checks and live browser smoke tests passing. No public deployment. See TASKS.md for optional follow-ups. Do not rebuild from scratch.

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
