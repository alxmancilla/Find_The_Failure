# Lineage Governance Spec

---
status: validated
owner: demo-team
created: 2026-10-26
updated: 2026-10-26
release_type: architecture review follow-up
baseline_tag: lineage-governance-2026-10-26
---

## 1. Problem

The remaining Enterprise Architecture review items: lineage is design-time only
(no single-order tracing), inferred edges cannot be confirmed or rejected,
curated dependency edges still bypass ingestion, and mappings have no version or
effective date and no link to standard metamodels.

## 2. Users and audience

- Primary user: enterprise / integration architect and data steward.
- Secondary users: operations analysts tracing a stuck order.
- Demo audience: architecture review boards and data-governance stakeholders.

## 3. Goals

- Trace one order by PO number against the lineage path.
- Let a data steward confirm or reject inferred lineage with an audit trail.
- Ingest curated dependency and process edges like all other context.
- Version and effective-date field mappings; answer "as of" questions.
- Map the model to ArchiMate and OpenLineage, and export OpenLineage events.

## 4. Product outcomes

- "Where is PO-4500012388 right now?" is answered with the hop where it stopped
  and the documents not produced.
- Inferred edges move to confirmed or rejected by an explicit, audited decision.
- Every relationship in the demo traces to a raw source record.
- Architects can align the model to their standards.

## 5. Demo success criteria

- PO-4500012345 shows nine delivered hops through cash application.
- PO-4500012388 shows a failure at Integration API → Apex ERP and the documents
  at risk downstream.
- Confirming the ASN → Invoice edge removes the inferred warning; rejecting it
  removes the edge from traversal; reset restores the original state.
- As-of 2025-01-01 shows the earlier X12 004010 mapping version.

## 6. Non-goals

- No live B2B tracking integration; message events are seeded.
- No external publishing of OpenLineage events.
- No changes to Workbench investigation behavior.

## 7. Requirements

- **REQ-001:** A `message_events` collection shall hold tracking events keyed by
  business identifiers, indexed by tenant, environment, flow, and PO number.
- **REQ-002:** `GET /api/lineage/flows/:flowKey/transactions` shall list sample
  transactions with derived status; `.../transactions/:value` shall align events
  to the flow path with per-hop status, stuck hop, and lineage data impact.
- **REQ-003:** `POST /api/lineage/edges/:key/review` shall record `confirmed` or
  `rejected` decisions with note, actor, timestamp, and history; rejected edges
  shall be excluded from lineage traversal.
- **REQ-004:** Lineage normalization shall preserve steward decisions;
  `POST /api/lineage/reviews/clear` shall reset decisions for rehearsal.
- **REQ-005:** Curated dependency and process edges shall be captured as batch
  `source_records` and normalized at seed time and on ingestion runs.
- **REQ-006:** Lineage edges shall carry `mapping_version`, `effective_from`, and
  `mapping_versions`; lineage responses shall accept `as_of` and return the
  mapping version effective on that date.
- **REQ-007:** `GET /api/lineage/metamodel` shall map element and relationship
  types to ArchiMate and OpenLineage concepts.
- **REQ-008:** `GET /api/lineage/flows/:flowKey/openlineage` shall export one
  OpenLineage RunEvent per hop with column-lineage facets from field mappings.

## 8. UX design

- Data view "Follow the PO number" gains a transaction picker that overlays
  per-hop delivery status on the design path.
- Inferred or reviewed hops show a Steward review block with Confirm / Reject.
- A Steward decisions section lists decisions with a reset action.
- Hops show mapping version and effective date; an "As of" date selects history.
- A Standards disclosure shows the ArchiMate / OpenLineage mapping and a link to
  the OpenLineage export.

## 9. Data and API design

- New collection `message_events`; relationship fields `mapping_version`,
  `effective_from`, `mapping_versions`, `review`, `review_history`.
- Inventory exports use fixture group `integration-inventory-baseline`.

## 10. MongoDB usage

- Business-key index on `message_events` for transaction tracing.
- `restrictSearchWithMatch` excludes rejected edges inside `$graphLookup`.
- Flexible documents hold mapping version history and review audit trails.

## 11. Acceptance criteria

- [x] Completed and stuck PO traces return expected statuses.
- [x] Stuck PO trace includes data impact with Invoice at risk.
- [x] Confirm and reject decisions persist, survive re-normalization, and reset.
- [x] Rejected edges are excluded from traversal.
- [x] Every relationship has a source record and provenance.
- [x] As-of lineage returns the prior mapping version.
- [x] Metamodel and OpenLineage export endpoints return valid shapes.
- [x] Workbench smoke results unchanged.

## 12. Product risks

- Seeded message events could be mistaken for live tracking; label as sample.

## 13. Validation plan

- `cd frontend && npm run build`; `npm run smoke`.

## 14. Implementation tasks

- [x] Message events and transaction trace.
- [x] Steward review.
- [x] Inventory edge ingestion.
- [x] Versioned mappings and as-of.
- [x] Metamodel and OpenLineage export.
- [x] UI, smoke, docs, and spec status.

## 15. Decisions

- Steward decisions live on the relationship (`review`, `review_history`) so the
  audit trail travels with the edge.
- A stuck order's downstream hops are `blocked`; documents at risk come from the
  same lineage data-impact traversal used by the Workbench.
- The OpenLineage export uses deterministic run ids derived from edge key and
  ingestion run id so repeated exports are stable.

## 16. Roadmap priority

1. Live B2B tracking ingestion.

## 17. Follow-ups

- Publish OpenLineage events to an external lineage backend.
