---
status: validated
owner: demo-team
created: 2026-10-31
updated: 2026-10-31
release_type: platform hardening
baseline_tag: business-key-attribute-pattern-2026-10-31
depends_on: [mongodb-hygiene]
amends: [lineage-governance, product-recall-traceability]
---

# Business-Key Attribute Pattern Spec

## 1. Problem

`message_events.business_keys` is an object, so each identifier needs its own
index: there are four today (PO number, supplier PO number, lot number, UDI).
Every new identifier adds an index, and each index slows writes.

## 2. Users and audience

- Primary: MongoDB SAs reviewing indexing.
- Secondary: engineers adding new business identifiers or flows.

## 3. Goals

- One index serves lookups by any business identifier.
- Keep `business_keys` for display and aggregation.

## 4. Product outcomes

- Adding an identifier needs no new index.

## 5. Demo success criteria

- Order, supplier PO, and lot traces return the same results as before.

## 6. Non-goals

- Changing `business_keys` itself or the API responses.

## 7. Requirements

- **REQ-001:** Each message event stores `business_key_attributes`, an array of
  `{ k, v }` pairs derived from `business_keys` when the document is validated.
- **REQ-002:** One index `{ tenant_id, environment, business_key_attributes.k,
  business_key_attributes.v, observed_at }` replaces the four per-identifier
  indexes.
- **REQ-003:** Transaction listing, single-transaction trace, identifier trace,
  customer grouping, and the recall untraceable-receipt lookup query
  `business_key_attributes` with `$elemMatch`.
- **REQ-004:** The `message_events` validator requires `business_key_attributes`
  with string `k` values.
- **REQ-005:** Trace results are unchanged.

## 8. UX design

None. The MongoDB proof panels show the new `$elemMatch` filters.

## 9. Data and API design

No API changes. Seed derives the attributes through the Mongoose validate hook.

## 10. MongoDB usage

Attribute pattern; multikey compound index with `$elemMatch` bounds on `k` and `v`.

## 11. Acceptance criteria

- [x] REQ-001, REQ-002, REQ-004 — automated: `backend/test/mongodb-setup.test.mjs`.
- [x] REQ-003 — automated: `backend/test/mongodb-setup.test.mjs` (`explain()`
  uses the new index for each query shape).
- [x] REQ-005 — automated: existing trace assertions in `scripts/full-smoke.mjs`.

## 12. Product risks

- Queries must use `$elemMatch`; a plain `{ "business_key_attributes.k": …,
  "business_key_attributes.v": … }` can match k and v from different pairs.

## 13. Validation plan

Seed, `cd backend && npm test`, `npm run smoke`, `npm run spec:check`.

## 14. Implementation tasks

- [x] Schema field, validate hook, index, validator.
- [x] Update the five query sites.
- [x] Amend `lineage-governance` REQ-001 and `product-recall-traceability` REQ-010.
- [x] Tests, docs, and spec status.

## 15. Decisions

- Accepted in advance by the demo owner on 2026-10-31; the draft was not
  reviewed separately.
- `flow` is not in the index; flow-scoped lookups filter it after the index scan.

## 16. Roadmap priority

1. Re-check index selectivity at real tracking volume.

## 17. Follow-ups

- Time series collection for `message_events`.
