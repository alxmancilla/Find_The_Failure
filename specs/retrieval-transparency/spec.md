---
status: draft
owner: demo-team
created: 2026-11-03
updated: 2026-11-03
release_type: UX / reliability
baseline_tag: none
depends_on: [local-demo-startup]
amends: []
---

# Retrieval Transparency Spec

## 1. Problem

- The related-context panel shows the engine as a raw id
  (`auto-embed-vector-rerank`), and doesn't say when retrieval fell back (for
  example, vector search returned nothing and Atlas Search answered). An empty
  panel says only "No related context found".
- Nothing in the UI says whether search and embeddings are ready. During the
  first minutes after a reseed, slow or keyword-only results look like a
  product problem. `GET /api/health` reports only the database connection.

## 2. Users and audience

- Primary user: the presenter, during the first minutes of a session.
- Secondary users: evaluators judging whether results can be trusted.
- Demo audience: MongoDB and architecture stakeholders.

## 3. Goals

- Every related-context result says how it was found, in plain words.
- Fallbacks and empty results explain themselves.
- A small header status shows database, search, and embedding readiness.

## 4. Product outcomes

- "Why is this empty?" is answered on screen.
- The presenter can see "warming up" and wait instead of guessing.

## 5. Demo success criteria

- Right after a reseed, the header shows "Embeddings warming up", then "Ready".
- Targets moved ([`demo-outcome-targets`](../demo-outcome-targets/spec.md)): none.

## 6. Non-goals

- Changing retrieval order or ranking.
- Readiness for every Atlas Search index individually in the UI.

## 7. Requirements

- **REQ-001:** The related-context response shall include `attempts`: each engine
  tried, in order, with outcome `answered`, `empty`, or `error` (no error text).
- **REQ-002:** The panel shall label the engine in plain words (vector search with
  reranking, Atlas Search with reranking, Atlas Search, keyword fallback), and
  when an earlier engine was skipped, say which and why ("vector search returned
  no results").
- **REQ-003:** When no documents are found, the panel shall name the engine used
  and suggest the next step (for example, "keyword fallback: Atlas Search
  indexes not ready").
- **REQ-004:** `GET /api/health` shall add `search: { indexes, auto_embedding }`
  with `indexes` in `ready | building | unavailable` and `auto_embedding` in
  `ready | warming | off`, from the state recorded at startup.
- **REQ-005:** The header shall show one status pill from `/api/health`: "Ready",
  "Search warming up", "Embeddings warming up", or "Database offline", polling
  every 10 s until ready and every 60 s after.
- **REQ-006:** Health and attempts responses shall not include connection
  strings, hosts beyond the current `db.host`, or raw driver errors.

## 8. UX design

- Panel: a muted line under the title, e.g. "Found with Atlas Search ·
  vector search returned no results".
- Header: a pill next to "Bounded agent PoC"; green Ready, amber warming,
  red offline; tooltip lists the three states.

## 9. Data and API design

- `related_context.attempts: [{ engine, outcome }]` (additive).
- `/api/health` adds `search` (additive); status code rules unchanged (503 only
  when the database is down).
- `searchIndex.js` records readiness in a small module-level state object.

## 10. MongoDB usage

Makes the Atlas Search / Vector Search / keyword fallback chain visible: a
direct way to explain retrieval options on Atlas vs. Atlas Local.

## 11. Acceptance criteria

- [ ] REQ-001 — automated: `backend/test/related-context.test.mjs`
- [ ] REQ-002 — automated: `InvestigationWorkbench.test.jsx` (fallback label)
- [ ] REQ-003 — automated: `InvestigationWorkbench.test.jsx` (empty-state copy)
- [ ] REQ-004 — automated: `backend/test/search-index.test.mjs` (state transitions); `scripts/full-smoke.mjs` (`search` present)
- [ ] REQ-005 — automated: `frontend/src/App.test.jsx` (pill text per state)
- [ ] REQ-006 — automated: `scripts/full-smoke.mjs` (health keys allowlist)

## 12. Product risks

- Showing "fallback" may make the demo look weaker; wording stays factual and short.
- Polling adds requests; intervals are small and stop being frequent once ready.

## 13. Validation plan

- Unit/API checks: `cd backend && npm test`.
- Frontend checks: `cd frontend && npm test`, `npm run build`.
- Smoke checks: `npm run smoke` on Atlas.
- Demo rehearsal checks: reseed on Atlas and watch the pill go from warming to Ready.

## 14. Implementation tasks

- [ ] `runRetrievalAttempts` records attempts; `relatedContextResult` returns them.
- [ ] Readiness state in `searchIndex.js`; `/api/health` exposes it.
- [ ] Panel labels and empty-state copy; header pill with polling.
- [ ] Tests listed above; `README.md` health response update.

## 15. Decisions

- Readiness comes from startup state, not a live query per health call, to keep
  `/api/health` fast and side-effect free.

## 16. Roadmap priority

1. REQ-001–REQ-003 (explain results).
2. REQ-004, REQ-005 (readiness status).
3. REQ-006.

## 17. Follow-ups

- Show readiness in Presenter Console as a pre-session checklist.
