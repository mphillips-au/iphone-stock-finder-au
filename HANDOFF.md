# Current handoff

Updated 2026-10-06, Australia/Melbourne.

## Manual stock checks enabled

User authorised stopping Cloudflare automatic stock updating to reduce usage and using manual checks instead. AGENTS.md now records the manual-mode architecture.

- Live Worker `iphone-stock-finder-au`, account `dc95dd5167fb36bb49ecfcb455e1f7e6`: removed the `*/15 * * * *` cron via API and verified `schedules: []`.
- `/api/stock/page` now uses the existing bounded live Telstra lookup with 20-second caching, regardless of saved D1 stock. Removed the scheduled handler. D1 data and static assets retained.
- Applied the tested bundled Worker through Cloudflare's content-only PUT endpoint, preserving settings/bindings/assets. Deployment ID: `ac8afdf7c21342be9aea996f6d17c634`. Wrangler CLI auth was expired; MCP OAuth worked.
- Verified `https://isc.mphillips.dev/api/stock/page` with one tracked SKU and Melbourne coordinates: 10 stores, complete true, no failed SKUs, current checkedAt, no snapshotAt. Site GET succeeded.
- Regression test first failed on old code returning seeded OLD stock, then passed with current upstream stock. All 35 tests, typecheck, build, dry-run and diff checks passed. No physical browser clicks or mobile layout review performed; no UI assets changed.
- Local checkout restored from GitHub because the configured directory was absent. User explicitly requested a PR and merge into the default branch (`master`) so future deployments preserve manual mode. GitHub records the final PR/check/merge outcome. Deploy from the merged manual-mode source; older revisions can restore automation.
- Existing Stores directory and header badge refer to historical D1 data. Browser stock auto-refresh defaults Off but remains available by explicit selection. Existing status polling remains; nationwide background indexing is disabled.

Changed: AGENTS.md, src/worker.ts, wrangler.jsonc, tests/stock.test.ts, README.md, docs/DECISIONS.md, TASKS.md, HANDOFF.md.

Validation: npm run check; npm test (35 passed); npm run build; WRANGLER_LOG_PATH=/tmp/iphone-stock-wrangler.log npm run deploy:check; git diff --check. npm ci reported 3 existing dependency vulnerabilities; no unrelated dependency upgrades applied.
