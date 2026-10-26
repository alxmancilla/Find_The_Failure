# Lineage Integration Spec

---
status: validated
owner: demo-team
created: 2026-10-26
updated: 2026-10-26
release_type: architecture review follow-up
baseline_tag: lineage-integration-2026-10-26
---

## 1. Problem

The Enterprise Architecture review of operational lineage found that lineage is
isolated: failure impact ignores it, Modernization ignores it, a few modelling
choices are inaccurate, and lineage queries are not scoped or indexed like the
Workbench hot paths.

## 2. Users and audience

- Primary user: enterprise / integration architect.
- Secondary users: operations analysts using the Workbench.
- Demo audience: architecture review boards and MongoDB stakeholders.

## 3. Goals

- Connect lineage to failure impact and modernization planning.
- Fix modelling inaccuracies architects will notice.
- Make lineage queries production-shaped.

## 4. Product outcomes

- A failing interface shows which downstream business documents are at risk.
- Replacing a system shows which transformations and mappings must be rebuilt.
- Lineage distinguishes data ownership from interface ownership.

## 5. Demo success criteria

- Integration API → Apex ERP impact shows Invoice and Cash Application at risk
  and the Hospital Invoicing and Cash Application process.
- Replacing X12 Translator shows the Canonical Order transformation, its field
  mappings, and outbound translation hops.
- Existing Workbench impact and investigation results remain unchanged.

## 6. Non-goals

- No change to `depends_on` edges or Workbench fault-domain ranking.
- No flows-as-data, ingestion-sourced lineage, or instance-level tracing yet.

## 7. Requirements

- **REQ-001:** Impact responses shall include `data_impact` derived from lineage:
  entities at risk, interfaces that can no longer produce them, business
  processes, inferred-edge count, and a MongoDB trace.
- **REQ-002:** Investigation results shall expose `data_impact` and the Workbench
  summary shall show a single "Data affected" line.
- **REQ-003:** Modernization responses shall include `lineage_impact`:
  transformations performed, entities produced and mastered, downstream
  dependent entities, field mappings to rebuild, and middleware translation hops.
- **REQ-004:** Cash Application shall be modelled as an Apex ERP record distinct
  from the hospital's Payment Remittance.
- **REQ-005:** `carries` and `consumes` edges shall reflect the entity that
  crosses the wire, not the post-transformation entity.
- **REQ-006:** Data entities shall carry a `data_owner` distinct from interface
  owners.
- **REQ-007:** Lineage hops shall expose middleware `via` systems and flag
  collapsed translation steps.
- **REQ-008:** Lineage queries shall be scoped by `tenant_id` and `environment`
  and supported by `{from_key, relationship_type}` / `{to_key,
  relationship_type}` indexes.

## 8. UX design

- Workbench Investigation Summary: one "Data affected" line, no new cards.
- Modernization: one "Data lineage impact" section.
- Catalog Data view: data owner on the entity panel; "via" systems on hops.

## 9. Data and API design

- `GET /api/impact/:key` adds `data_impact`.
- Investigation responses add `data_impact`.
- `GET /api/modernization/:systemKey` adds `lineage_impact`.
- `data_entities` adds `data_owner`; new `cash-application` entity.
- `owners` adds Order-to-Cash Data Stewardship.

## 10. MongoDB usage

- `$graphLookup` over scoped `transforms_to` edges powers lineage, data impact,
  and modernization lineage impact.
- Compound indexes align with `connectToField` plus `restrictSearchWithMatch`.

## 11. Acceptance criteria

- [x] Data impact for `if-integration-erp` includes Invoice and Cash Application.
- [x] Workbench impacted business processes are unchanged.
- [x] Modernization of X12 Translator includes Canonical Order lineage impact.
- [x] Purchase Order downstream lineage reaches Cash Application.
- [x] Entities expose data owners; hops expose `via` systems.
- [x] Full smoke passes with new assertions.

## 12. Product risks

- Data impact could be read as confirmed revenue loss; label it "at risk" and
  show inferred edges.

## 13. Validation plan

- `cd frontend && npm run build`; `npm run smoke`.

## 14. Implementation tasks

- [x] Modelling fixes (REQ-004..007).
- [x] Tenant scope and indexes (REQ-008).
- [x] Data impact (REQ-001, REQ-002).
- [x] Lineage-aware Modernization (REQ-003).
- [x] Smoke, docs, and spec status.

## 15. Decisions

- Data impact is additive; it never alters dependency-based impact.
- `carries`/`consumes` model the wire entity: receivers that transform consume
  the input; senders that transform publish the output.
- The invoice → remittance step is a partner-side process (no Apex interface)
  sourced from the trading partner agreement.
- Persisted investigation traces store pipelines as shell-style strings to avoid
  `$`-prefixed keys in case memory.

## 16. Roadmap priority

1. Ingestion-sourced lineage and a single canonical edge store.
2. Flows as data.
3. Instance-level PO tracing.

## 17. Follow-ups

- Steward confirm/reject workflow for inferred edges.
