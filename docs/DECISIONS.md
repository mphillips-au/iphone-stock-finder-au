# Implementation decisions

- One Worker plus Vite-built static assets, per master prompt. Worker-first routing only for `/api/*`.
- Framework-independent shared models/scan helpers make important behavior testable without the browser.
- No external store database: browser directory accumulates metadata from stock pages.
- Unknown/missing inventory remains unknown, including when batches fail.
- Product/launch catalogue is user-supplied; discovery enriches it but cannot disable fallback.
- Budget stock requests explicitly; a pathological sequence of 413s cannot make one invocation exceed the outbound request budget.
- Product UI follows the creator's design context in the master prompt; no additional design interview is needed.
- Live verification found Workers fetch must not be invoked as a method of an arbitrary context object; the default transport wraps global fetch. Workers support redirect `manual`, not `error`; non-2xx redirects are rejected explicitly. Keep the runtime smoke test in addition to Node fixture tests.
- Secondary-screen chunk failures (e.g. an old tab across a deployment) have a reload recovery screen rather than leaving the app blank.
