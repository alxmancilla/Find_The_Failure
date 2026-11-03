---
status: implemented
owner: demo-team
created: 2026-11-03
updated: 2026-11-03
release_type: reliability
baseline_tag: none
depends_on: []
amends: []
---

# Local Demo Startup Spec

## 1. Problem

A fresh-clone run of the `DECK-dev.md` "Try it" slide (2026-11-03) failed on
the first attempt and passed on the second. A reseed on Atlas showed a second,
related gap:

- **Atlas Local:** `demo.sh` waits only for port 27017. The backend asks for
  search indexes before the container's search engine is ready, gets
  `Error connecting to Search Index Management service` once per collection,
  never retries, and falls back to regex. `npm run smoke` fails with
  `typo-tolerant search empty`.
- **Atlas (auto-embedding on):** after a reseed, the vector index reports
  `READY` while embeddings are still being generated. `$vectorSearch` returns 0
  documents without an error, so retrieval does not fall back, and the first
  investigation shows no related context. `npm run smoke` fails with
  `related context missing` for about two minutes.
- **Port clash:** if another MongoDB holds port 27017, `docker compose up` fails
  and `demo.sh` still sees "something" on the port, so it can seed the other
  database.

## 2. Users and audience

- Primary user: a developer following the "Try it" slide on their own machine.
- Secondary users: the presenter starting the demo before a session.
- Demo audience: developers (DECK-dev.md).

## 3. Goals

- `npm run demo` on a fresh clone gives working Atlas Search on the first run.
- Related context is never empty only because embeddings are still building.
- A port clash stops the launcher with a clear message instead of a wrong seed.

## 4. Product outcomes

- The "Try it" slide works as written, with no rerun.
- Startup logs say what the backend is waiting for and how it ended.

## 5. Demo success criteria

- Fresh clone, empty Docker volume: `npm run demo`, then `npm run smoke` passes
  on the first try.
- Atlas reseed with auto-embedding on: `npm run smoke` passes right after the
  backend logs that it is listening.

## 6. Non-goals

- A configurable MongoDB port for Atlas Local.
- Changing which retrieval engine is preferred, or the ranking itself.
- Blocking server start forever: on timeout the server starts with fallbacks.

## 7. Requirements

- **REQ-001:** If a vector retrieval attempt returns 0 documents, the system
  shall try the next retrieval attempt (Atlas Search rerank, then Atlas Search)
  instead of returning an empty result, and report the engine that answered.
- **REQ-002:** If creating a search index fails with a transient error (the
  search service is not reachable yet), the backend shall retry until the index
  is created or a startup timeout (default 120 s) passes, logging each retry
  at most once per collection per 10 s.
- **REQ-003:** When `ENABLE_ATLAS_AUTO_EMBED_INDEX=true`, startup shall wait until
  a probe `$vectorSearch` on `operational_knowledge` returns at least one
  document, or a timeout (default 180 s) passes, and log which happened.
- **REQ-004:** On any startup timeout the server shall still start, and the log
  shall name the fallback in use (regex search or Atlas Search for context).
- **REQ-005:** Before `docker compose up`, `demo.sh` shall exit with a non-zero
  code and a message naming the port and the process or container holding it,
  if port 27017 is in use by anything other than the `ftf-mongo` container.
- **REQ-006:** `demo.sh` shall wait until the `ftf-mongo` container reports
  `healthy` (timeout 120 s, then exit with a message) before seeding.
- **REQ-007:** The README quick start and the `DECK-dev.md` "Try it" slide shall
  say that port 27017 must be free and that the first start pulls the image.

## 8. UX design

Console output only. Example lines:
`[search] search service not ready, retrying (interfaces)` ·
`[search] auto-embedding ready: probe returned 8 documents after 95 s` ·
`[demo] port 27017 is in use by container fle-demo-mongodb; stop it or free the port`.

## 9. Data and API design

- No collection or API change. `related_context.engine` already reports the
  engine; with REQ-001 it may be `atlas-search` when vector returned nothing.
- New optional env vars: `SEARCH_INDEX_TIMEOUT_MS`, `AUTO_EMBED_READY_TIMEOUT_MS`.

## 10. MongoDB usage

- `createSearchIndex` / `listSearchIndexes` retried on transient errors.
- `$vectorSearch` with auto-embedding used as a readiness probe: `READY` means
  the index exists, not that every document is embedded.
- Atlas Local readiness via the container health check rather than the port.

## 11. Acceptance criteria

- [ ] REQ-001 — automated: `backend/test/related-context.test.mjs`
- [ ] REQ-002 — automated: `backend/test/search-index.test.mjs` (stubbed transient error)
- [ ] REQ-003 — automated: `backend/test/search-index.test.mjs` (stubbed probe); manual: Atlas reseed + immediate smoke, by demo-team
- [ ] REQ-004 — automated: `backend/test/search-index.test.mjs` (timeout path)
- [ ] REQ-005 — manual: run `npm run demo` with another MongoDB on 27017, by demo-team
- [ ] REQ-006 — manual: fresh clone, empty volume, `npm run demo` then `npm run smoke` passes first time, by demo-team
- [ ] REQ-007 — manual: README and DECK-dev.md reviewed, by demo-team

## 12. Product risks

- Longer first start (up to a few minutes) may look like a hang; logs must show progress.
- Falling back on empty vector results can hide a broken embedding setup; the
  engine name in the trace keeps it visible.
- The Atlas Local health check may change between image versions.

## 13. Validation plan

- Unit/API checks: `cd backend && npm test`.
- Frontend checks: none (no UI change).
- Smoke checks: `npm run smoke` on Atlas right after a reseed.
- Demo rehearsal checks: fresh clone in a temp folder with an empty Docker
  volume, first-run smoke; port-clash run with another MongoDB on 27017.

## 14. Implementation tasks

- [x] `relatedContext.js`: treat 0 vector results as "try next attempt".
- [x] `searchIndex.js`: retry transient creation errors; auto-embed readiness probe; configurable timeouts.
- [x] `config.js` / `.env.example`: the two timeout variables.
- [x] `scripts/demo.sh`: port-owner check; wait for container `healthy`.
- [x] Backend tests for REQ-001–REQ-004.
- [x] README quick start and DECK-dev.md "Try it" note.

## 15. Decisions

- Fail fast on a port clash rather than pick another port: one documented
  setup, and no risk of seeding someone else's database.
- Start the server on timeout instead of exiting: the fallbacks keep the demo usable.

## 16. Roadmap priority

1. REQ-001 and REQ-003 (affect the Atlas demo today).
2. REQ-002, REQ-005, REQ-006 (fresh-clone "Try it" path).
3. REQ-007 (docs).

## 17. Follow-ups

- Show the retrieval engine in the Workbench related-context panel.
