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
- React + Vite + strict TypeScript; one Cloudflare Worker with static assets. No external database, authentication, or traditional server.
- Browser calls only `/api/*`; all Telstra requests happen in Worker modules.
- Stock requests always use `size: 10`, offsets in multiples of 10, sequential bounded SKU batches, and bounded retries.
- One store page per Worker request. Budget every upstream attempt (including 413 splits and retries) below free-tier subrequest limits.
- Exact stock status `available` is available. Missing/error/unknown stock is UNKNOWN, never silently unavailable.
- Join stock place.id to exact storecode; dedupe products by SKU and stock by storecode+SKU.
- Preserve successful pages/batches on failure and permit continuation. Never report a partial scan as complete.
- Store inventory matches exact storecode, never array position. Pagination remains browser-orchestrated.
- Cache by coordinates, sorted SKU set, offset and relevant parameters. No idle polling; auto-refresh defaults off and pauses when hidden.
- Treat all upstream data as untrusted; validate inputs and tolerate schema drift without inventing stock.
- Fallback SKUs and launch dates are supplied by the master prompt, not independently verified product facts.

## Design context
Personal Australian launch-day utility used on phones while travelling between stores. Primary jobs: find an exact phone nearby and inspect every tracked SKU at one store. Calm, premium, precise, fast; near-white surfaces, charcoal text, restrained electric blue accents, green only for real available stock. Original identity and clear unofficial footer. Mobile, keyboard accessibility, truthful progress/error/empty states matter more than decoration.

## Verification
Run `npm run check`, `npm test`, `npm run build`, and `npm run deploy:check` before marking final readiness. Add regression tests for nontrivial stock/data behavior. Review mobile and desktop UI. Record environmental failures with exact commands and recovery steps. No TODO or mocked inventory in production paths.
