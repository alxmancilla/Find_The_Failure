# MongoDB Hygiene Spec

---
status: validated
owner: demo-team
created: 2026-10-27
updated: 2026-10-27
release_type: platform hardening
baseline_tag: TBD
---

## 1. Problem

A best-practice review found three low-risk gaps:

- **No database-enforced validation.** Rules live only in Mongoose; several
  collections use `strict: false` and `Mixed` fields.
- **Redundant and unusable indexes.** `relationships` has overlapping pairs,
  `interfaces` has an unused `text` index, `operational_knowledge` has four
  unused indexes, and several Workbench queries omit `tenant_id` /
  `environment`, so the tenant-first indexes built for them are never used.
  Mongoose also never drops an index removed from a schema.
- **Default connection settings.** No `appName`, `maxPoolSize`, or
  `serverSelectionTimeoutMS`.

## 2. Users and audience

- Primary: MongoDB SAs and architects reviewing the demo's data layer.
- Secondary: engineers extending the demo.

## 3. Goals

- Enforce document shape in the database without blocking the flexible model.
- Keep only indexes that serve real query shapes, and make queries use them.
- Make connection behaviour explicit and visible in Atlas monitoring.

## 4. Product outcomes

- Reviewers can see validators, index rationale, and connection settings.
- No change to demo behaviour or smoke results.

## 5. Demo success criteria

- Startup logs report validator status and non-matching document counts.
- `explain()` shows the hot-path queries using the intended indexes.

## 6. Non-goals

- Transactions, bounded arrays, the Attribute pattern for `business_keys`,
  time series collections, tenant-scoped uniqueness (separate specs).
- Scoping batch ingestion reads (`record_type: "lineage"` / `"relationship"`).

## 7. Requirements

- **REQ-001:** `$jsonSchema` validators with `validationLevel: "moderate"` and
  `validationAction: "warn"` on `relationships`, `message_events`,
  `source_records`, and `lineage_flows`.
- **REQ-002:** Validators require identity and scope fields, check types
  (`confidence` 0–1, `confirmed` boolean, dates), and list known enums
  (`relationship_type`, `from_type` / `to_type`, `record_type`, `status`).
- **REQ-003:** Startup and seed apply validators idempotently and log, per
  collection, how many documents do not match.
- **REQ-004:** Remove redundant or unused indexes:
  - `relationships`: `{from_type, from_key, relationship_type}`,
    `{to_type, to_key, relationship_type}`, and their tenant-prefixed twins
    (served by the `from_key` / `to_key`-first indexes).
  - `interfaces`: the classic `text` index (search uses Atlas Search).
  - `operational_knowledge`: all four secondary indexes (retrieval uses Atlas
    Search / Vector Search).
  - `investigation_cases`: `{alert_key, createdAt}`, `{status, updatedAt}`,
    and `{tenant_id, environment, status, updatedAt}`, replaced by
    `{tenant_id, environment, updatedAt}` for the case list.
  - `source_records`: `{source_system, record_type}`, `{entity_type, entity_key}`.
- **REQ-005:** Scope Workbench hot-path queries by `tenant_id` and
  `environment`: alert inbox, alert deduplication, change correlation, case
  list, and interface event history.
- **REQ-006:** Seed and startup run `syncIndexes()` so removed indexes are
  dropped; Atlas Search indexes are untouched.
- **REQ-007:** Connection sets `appName`, `maxPoolSize`, and
  `serverSelectionTimeoutMS`, configurable via `.env`.

## 8. UX design

None.

## 9. Data and API design

No API or response changes. New env vars: `MONGO_APP_NAME`,
`MONGO_MAX_POOL_SIZE`, `MONGO_SERVER_SELECTION_TIMEOUT_MS`.

## 10. MongoDB usage

`collMod` / `createCollection` with `validator`; `$nor: [{ $jsonSchema }]` to
count non-matching documents; `Model.syncIndexes()`; `explain("queryPlanner")`
to confirm index selection.

## 11. Acceptance criteria

- [x] Validators present in `listCollections` with action `warn`.
- [x] 0 non-matching documents after seed, and with the demo feed and
  enterprise fixture pack loaded and normalized.
- [x] 14 removed indexes dropped by `syncIndexes()`; all 12 checked hot-path
  queries use an `IXSCAN` on the intended index.
- [x] `npm run smoke`, `backend/smoke.mjs`, and `cd frontend && npm test` pass
  with unchanged results.

## 12. Product risks

- `syncIndexes()` drops any index created by hand outside the schemas.
- `warn` does not block bad writes; switch to `error` only after a clean period.

## 13. Validation plan

Seed, start, run smokes and frontend tests, inspect validators/indexes, run
`explain()` on hot-path queries.

## 14. Implementation tasks

- [x] Connection settings.
- [x] Index cleanup, query scoping, `syncIndexes()`.
- [x] Validators and startup report.
- [x] Docs and spec status.

## 15. Decisions

- `moderate` + `warn` keeps the flexible model and existing documents writable.
- On an empty `investigation_cases` collection the planner serves similar-case
  retrieval from `{tenant_id, environment, updatedAt}`; with real volume it may
  choose the per-key `$or` indexes instead. Both are tenant-first.

## 16. Roadmap priority

1. Transactions for multi-step writes.
2. Bounded arrays and history collections.
3. Attribute pattern for `message_events.business_keys`.

## 17. Follow-ups

- Switch validators to `error` after a clean rehearsal period.
