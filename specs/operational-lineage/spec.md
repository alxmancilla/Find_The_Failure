# Operational Lineage (Order-to-Cash) Spec

---
status: validated
owner: demo-team
created: 2026-10-26
updated: 2026-10-26
release_type: architecture demo extension
baseline_tag: operational-lineage-2026-10-26
---

## 1. Problem

Architects cannot easily answer how a business document moves across systems:
where an order originates, which interfaces carry it, where it changes shape,
which system is the record of truth, and what depends on it downstream. The
current demo answers "what is impacted when an interface fails?" but not "how
does order-to-cash data flow end to end?"

## 2. Users and audience

- Primary user: enterprise / integration architect.
- Secondary users: integration engineers, application owners.
- Demo audience: architecture stakeholders evaluating MongoDB as an
  operational context layer.

## 3. Goals

- Show operational (system-to-system) lineage for the order-to-cash flow.
- Follow one business identifier, the hospital PO number, from order to cash.
- Make transformations, system of record, and trust (confirmed vs inferred)
  explicit.
- Reuse the existing graph and data model; keep the Workbench path unchanged.

## 4. Product outcomes

- Architects can trace any order-to-cash entity upstream and downstream.
- Architects can see where data changes shape and which system owns the truth.
- Change planning can start from a data entity, not only from a system.

## 5. Demo success criteria

- Selecting **Purchase Order** shows the full path to **Payment Remittance**
  with transformation labels.
- The PO number is visibly carried through every hop (850 → canonical order →
  sales order → 855 → 856 → 810 → 820).
- Each lineage edge shows provenance and confirmed/inferred status.
- The lineage story fits in about three minutes and does not add Workbench cards.

## 6. Non-goals

- No analytical/warehouse or column-level lineage across BI pipelines.
- No automated lineage discovery; lineage is curated seed plus fixture evidence.
- No Patient FHIR flow and no Supplier Replenishment (procure-to-pay) in scope.
- No changes to Workbench alert investigation behavior.

## 7. Requirements

- **REQ-001:** The model shall define order-to-cash data entities: Purchase
  Order, Canonical Order, Sales Order, Inventory Request (reservation), Order
  Status, Order Acknowledgment, Advance Ship Notice, Invoice, and Payment
  Remittance.
- **REQ-002:** The seed shall add the missing "cash" interfaces: outbound EDI 856
  ship notice, outbound EDI 810 invoice, and inbound EDI 820 payment remittance.
- **REQ-003:** Every order-to-cash interface shall declare the entities it
  carries, its input/output entity, and its transformation.
- **REQ-004:** Lineage shall be stored as typed `relationships` edges:
  `produces`, `carries`, `transforms_to`, `consumes`, and `system_of_record`,
  with provenance, confidence, and confirmed flags.
- **REQ-005:** Key identifier mappings (PO number, order line, quantity, amount)
  shall be stored on interfaces as flexible `lineage.field_mappings`.
- **REQ-006:** `GET /api/lineage/:entityKey?direction=upstream|downstream|both`
  shall return lineage nodes, edges, transformations, owners, and trust status.
- **REQ-007:** `GET /api/lineage/flows/order-to-cash` shall return the ordered
  end-to-end path for the demo story.
- **REQ-008:** Catalog Explorer shall offer a **System view / Data view** lens;
  Data view starts from a selected entity and highlights its path.
- **REQ-009:** Lineage edge types shall not change existing `depends_on` impact
  traversal or Workbench investigation results.
- **REQ-010:** At least one lineage edge shall be inferred/unconfirmed from
  legacy evidence (a lineage workbook row) to demonstrate trust signals.

## 8. UX design

Catalog Explorer gains a compact lens toggle: **System view** (current) and
**Data view**. In Data view the user picks an entity (default: Purchase Order).
The graph shows entities and systems along the path; edges are labeled with the
interface and transformation (for example, "X12 850 → canonical JSON"). A side
panel shows:

- system of record for the selected entity
- upstream origin and downstream consumers
- PO number field mapping per hop
- owners per hop
- confirmed vs inferred edges with evidence

Optional bridge (follow-up, not phase 1): one "Data affected" line in the
Workbench Investigation Summary.

## 9. Data and API design

- `data_entities`: add new entity documents with `domain: "order-to-cash"`,
  `system_of_record`, and `identifiers` (for example `po_number`).
- `interfaces`: add `if-erp-856`, `if-erp-810`, `if-hospital-820`; add
  `lineage: { input_entity, output_entity, transformation, field_mappings[] }`
  to order-to-cash interfaces.
- `relationships`: add lineage edges with `from_type`/`to_type` of
  `data_entity`, `system`, or `interface`, plus `flow`, `interface_key`,
  `transformed_by`, and `transformation` attributes.
- One `transforms_to` edge (ASN → Invoice) is inferred at 0.6 confidence from
  `legacy-lineage-workbook`.
- `business_processes`: add Hospital Invoicing and Cash Application so the new
  810/820 interfaces have process mappings.
- `GET /api/lineage/entities` lists order-to-cash entities for the Data view.
- Search responses include `data_entities`.
- New endpoints: REQ-006, REQ-007.

## 10. MongoDB usage

- `$graphLookup` over `relationships` with `restrictSearchWithMatch` on lineage
  relationship types for upstream/downstream traversal.
- Flexible documents hold protocol-specific field mappings (X12 segments, JSON
  paths, ERP fields) without a rigid schema.
- Provenance and confidence on edges make lineage auditable.
- Atlas Search over `data_entities` business terms (for example "PO", "810",
  "invoice") resolves architect search to lineage entry points.

## 11. Acceptance criteria

- [x] Purchase Order downstream lineage reaches Payment Remittance.
- [x] Invoice upstream lineage reaches Purchase Order.
- [x] PO number mapping is returned for every hop.
- [x] Each edge exposes provenance and confirmed/inferred status.
- [x] Data view lens renders the lineage path in Catalog Explorer.
- [x] Existing Workbench smoke results are unchanged.
- [x] Full smoke includes lineage assertions and passes.

## 12. Product risks

- Two stories competing: keep lineage in Catalog Explorer, not the Workbench.
- Curated lineage may be perceived as auto-discovered; label it as curated plus
  ingested evidence.
- New interfaces could change topology graphs; lineage-only edge types and
  scoped `depends_on` links must keep impact results stable.

## 13. Validation plan

- API checks: lineage endpoints for Purchase Order, Invoice, and the flow.
- Frontend checks: `cd frontend && npm run build`; Data view manual check.
- Smoke checks: extend `scripts/full-smoke.mjs` with lineage assertions.
- Demo rehearsal: three-minute "follow the PO number" walkthrough.

## 14. Implementation tasks

- [x] Add order-to-cash entities and cash interfaces to seed data.
- [x] Add lineage metadata and field mappings to interfaces.
- [x] Add lineage relationship edges and one inferred legacy-evidence edge.
- [x] Add Atlas Search index for `data_entities`.
- [x] Add lineage service and endpoints.
- [x] Add Catalog Explorer Data view lens.
- [x] Extend smoke, README, and DEMO runbook.

## 15. Decisions

- Scope is operational lineage for order-to-cash only.
- Audience is architecture; field mappings are limited to key identifiers.
- Lineage lives in Catalog Explorer; the Workbench stays summary-first.

## 16. Roadmap priority

1. Lineage model, seed data, and endpoints.
2. Data view lens.
3. Change-impact from a field ("what breaks if PO number format changes?").

## 17. Follow-ups

- Workbench "Data affected" bridge — delivered in
  [`lineage-integration`](../lineage-integration/spec.md), which also adds Cash
  Application, data owners, wire-entity semantics, and tenant-scoped indexes.
- OpenLineage-style event ingestion as `source_records`.
- Field-change impact analysis.
