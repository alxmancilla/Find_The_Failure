# Architecture Integrity Spec

---
status: validated
owner: demo-team
created: 2026-10-26
updated: 2026-10-26
release_type: architecture review follow-up
baseline_tag: architecture-integrity-2026-10-26
---

## 1. Problem

The Enterprise Architecture review found three integrity gaps: the graph has
multiple representations (embedded interface arrays plus typed relationships),
lineage edges bypass the ingestion pipeline the demo promotes, and the
order-to-cash flow is hard-coded. Navigation also exposes six equal tabs with no
architect path.

## 2. Users and audience

- Primary user: enterprise / integration architect.
- Secondary users: presenters and operations analysts.
- Demo audience: architecture review boards and MongoDB stakeholders.

## 3. Goals

- Make `relationships` the single canonical edge store.
- Ingest lineage through `source_records` with provenance like other context.
- Store lineage flows as data.
- Give architects a clear navigation path.

## 4. Product outcomes

- Every lineage edge is traceable to a raw source record and ingestion run.
- Adding a new flow requires data, not code.
- Presenters can follow an Operations path or an Architecture path.

## 5. Demo success criteria

- Context Ingestion shows lineage catalog, workbook, partner-agreement, and
  entity-master records as raw evidence.
- Lineage, data impact, modernization, and Workbench results are unchanged.
- The header shows Operations, Architecture, and Platform groups; legacy views
  move under More.

## 6. Non-goals

- No instance-level PO tracing.
- No change to Workbench investigation behavior.
- No removal of Presenter Console or Classic Investigation.

## 7. Requirements

- **REQ-001:** Dependency traversal (`/flow`, impact chain) shall read
  `depends_on` edges from `relationships`; interfaces shall not persist
  `downstream_interfaces`.
- **REQ-002:** Interfaces shall not persist `lineage`; lineage attributes
  (input/output entity, transformation, field mappings) shall live on lineage
  edges.
- **REQ-003:** Seed shall load lineage as `source_records` (record type
  `lineage`) from an integration-catalog lineage export, a data-entity master
  export, a trading-partner agreement, and a legacy lineage workbook.
- **REQ-004:** A lineage normalizer shall derive `transforms_to`, `carries`,
  `produces`, `consumes`, and `system_of_record` edges with provenance,
  `source_record_id`, `evidence_source_records`, and an ingestion run id; it shall
  run at seed time and during `POST /api/ingestion/run`.
- **REQ-005:** A `lineage_flows` collection shall hold flow key, name, domain,
  business identifier, entity order, and ordered interface path.
- **REQ-006:** Lineage services shall read entity order and path from the flow
  document; `GET /api/lineage/flows` and `GET /api/lineage/flows/:flowKey` shall
  expose flows.
- **REQ-007:** Navigation shall group views into Operations, Architecture, and
  Platform, with Presenter Console and Classic Investigation under More.
- **REQ-008:** The Data view shall link an entity's system of record to
  Modernization with that system preselected.

## 8. UX design

- Header groups: Operations (Investigation Workbench), Architecture (Catalog &
  Lineage, Modernization), Platform (Context Ingestion), More (legacy views).
- Data view entity panel: "Plan a change to <system>" opens Modernization.

## 9. Data and API design

- New collection `lineage_flows`.
- `source_records` gains `record_type: "lineage"` with fixture group
  `o2c-lineage-catalog`.
- `relationships` lineage edges gain `input_entity`, `output_entity`, and
  `field_mappings`.
- Endpoints: `GET /api/lineage/flows`, `GET /api/lineage/flows/:flowKey`.

## 10. MongoDB usage

- `$graphLookup` over `relationships` for both dependency and lineage traversal.
- Flexible `source_records` payloads hold heterogeneous lineage exports.
- Flow documents drive traversal ordering without code changes.

## 11. Acceptance criteria

- [x] Flow graph for `if-hospital-850` still returns 9 nodes / 8 edges.
- [x] No interface document has `downstream_interfaces` or `lineage`.
- [x] Every lineage edge has `provenance.source_record_key` and an ingestion run id.
- [x] Lineage source records appear in the ingestion dashboard.
- [x] Flows endpoint lists order-to-cash with entity order and path.
- [x] Workbench, lineage, data impact, and modernization smoke results unchanged.

## 12. Product risks

- More source records make Context Ingestion busier; group them by source.

## 13. Validation plan

- `cd frontend && npm run build`; `npm run smoke`.

## 14. Implementation tasks

- [x] Lineage source records and normalizer.
- [x] Relationship-only dependency traversal.
- [x] Flow documents and endpoints.
- [x] Grouped navigation and Modernization link.
- [x] Smoke, docs, and spec status.

## 15. Decisions

- Dependency edges remain curated seed edges; only lineage moves to ingestion in
  this slice.
- Lineage exports use their own fixture group (`o2c-lineage-catalog`) so
  clearing the enterprise fixture pack never removes lineage.
- Field mappings live on `carries` and `transforms_to` edges; `carries` is the
  canonical record of each interface hop, including hops that do not change
  shape.
- Ingestion run responses keep `relationship_upserts` unchanged and report
  lineage separately as `lineage_relationship_upserts`.

## 16. Roadmap priority

1. Instance-level PO tracing against the lineage path.
2. Steward confirm/reject workflow for inferred edges.

## 17. Follow-ups

- Move curated dependency edges to an ingested catalog export as well.
