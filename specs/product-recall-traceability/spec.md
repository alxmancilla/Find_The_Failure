# Product Recall Traceability Spec

---
status: validated
owner: demo-team
created: 2026-10-27
updated: 2026-10-27
release_type: architecture demo extension
baseline_tag: TBD
depends_on: procure-to-pay
---

## 1. Problem

When a manufacturer recalls a device lot, a distributor must quickly answer:
which receipts brought the lot in, how much is still on hand, which hospitals
received it on which orders and shipments, and who must act. Today that answer
spans supplier EDI, receiving, inventory, and customer shipping records.

## 2. Users and audience

- Primary user: quality and regulatory affairs; integration architects.
- Secondary users: operations and customer service.
- Demo audience: healthcare supply stakeholders; architects evaluating
  cross-flow lineage.

## 3. Goals

- Trace one lot number across procure-to-pay and order-to-cash.
- Show where the lot identifier is and is not carried (traceability gaps).
- Produce a read-only recall impact summary with safe next actions.

## 4. Product outcomes

- "Where did lot L-2291 go?" is answered in one view instead of hours of joins.
- Architects see the exact hops that carry the lot and the ones that lose it.
- The same model serves design-time lineage, run-time tracing, and recall.

## 5. Demo success criteria

- Selecting recall **RCL-2026-014** shows lot **L-2291**: inbound supplier ship
  notice, goods receipt, quantity on hand, and three hospital customers with
  their orders and outbound ship notices.
- The identifier-coverage view shows lot mapped from supplier 856 through
  outbound 856, and absent on order, invoice, and remittance hops (expected).
- Setting **As of** before the supplier 856 v2 mapping shows receipts where the
  lot was not captured, flagged as untraceable.
- Recommended actions are labelled local and read-only.

## 6. Non-goals

- No regulatory submission (FDA, DSCSA) or customer notification is sent.
- No change to Workbench investigation behavior in this phase.
- No serial-number (unit-level) tracing; lot level only.

## 7. Requirements

- **REQ-001:** Seed shall add entities **Recall Notice** (system of record
  Meridian Medical Supply) and **Inventory Lot** (system of record Inventory
  Service), with `lot_number` and `udi_device_identifier` identifiers.
- **REQ-002:** A new owner **Quality & Regulatory Affairs** shall be the data
  owner of Recall Notice and Inventory Lot.
- **REQ-003:** Lineage exports shall add the cross-flow chain Supplier Ship Notice
  → Goods Receipt → Inventory Lot → Advance Ship Notice (order-to-cash), with
  `lot_number` field mappings, so `$graphLookup` crosses flow boundaries.
- **REQ-004:** The supplier 856 lot mapping shall be versioned: v1 without lot
  capture before 2025-09-01, v2 with lot capture afterwards.
- **REQ-005:** A `source_records` recall notice (`record_type: "recall"`) from a
  supplier recall feed shall reference the lot, device identifier, reason, and
  class.
- **REQ-006:** `message_events` shall carry `lot_number` and `ship_to` business
  keys on supplier receipt and outbound shipment events: one inbound receipt and
  shipments to three hospital customer accounts, plus one pre-v2 receipt without
  a lot.
- **REQ-007:** `GET /api/lineage/identifiers/:identifier/:value` shall return,
  across all flows: matching events grouped by flow and hop, affected customers
  with orders, shipments, and quantities, on-hand quantity, and untraceable
  receipts.
- **REQ-008:** `GET /api/lineage/identifiers/:identifier/coverage` shall list, per
  flow hop, whether the identifier is mapped, with mapping version.
- **REQ-009:** `GET /api/recalls` and `GET /api/recalls/:key` shall return recall
  notices with the lot trace and recommended read-only actions (quarantine
  on-hand stock, notify affected hospitals, hold open orders, notify supplier
  quality).
- **REQ-010:** The business-key index shall cover `business_keys.lot_number`.

## 8. UX design

- Architecture group gains **Recall trace**, a single panel (no new tab family):
  recall picker, lot summary (received, on hand, shipped), affected-customer
  table, cross-flow path with identifier coverage, untraceable-receipt warning,
  and recommended actions with a local-only guardrail.
- Link from each affected shipment to the order-to-cash order trace.

## 9. Data and API design

- New fixture group `recall-traceability`; new `record_type: "recall"`.
- Customer accounts are business keys (`ship_to`), not new systems; the demo
  keeps one hospital trading-partner interface.
- New endpoints: REQ-007, REQ-008, REQ-009.

## 10. MongoDB usage

- Business-key lookup on `message_events` plus `$group` by customer and flow.
- `$graphLookup` across flows over the same `transforms_to` edges.
- Versioned mappings expose historical traceability gaps.
- Optional follow-up: change streams to react to new recall notices.

## 11. Acceptance criteria

- [x] Lot L-2291 trace returns one receipt, three customers, and on-hand quantity.
- [x] Coverage marks lot mapped on 856-in, receipt, lot, and 856-out hops only.
- [x] As-of before 2025-09-01 reports the untraceable receipt.
- [x] Recall detail includes read-only recommended actions.
- [x] Inventory Lot lineage crosses into order-to-cash (via the recall trace and
  coverage; see Decisions).
- [x] Existing flows, governance, and Workbench smoke results unchanged.

## 12. Product risks

- Recall is emotive; keep data clearly fictional and actions clearly local.
- Customer accounts as business keys simplify multi-customer EDI; state it.

## 13. Validation plan

- `cd frontend && npm run build`; `npm run smoke` with recall assertions.
- Rehearse a three-minute "recall lot L-2291" walkthrough.

## 14. Implementation tasks

- [x] Recall entities, owner, cross-flow lineage, and versioned 856 mapping.
- [x] Recall notice source record and lot-keyed message events.
- [x] Identifier trace, coverage, and recall endpoints.
- [x] Recall trace panel; smoke, docs, and spec status.

## 15. Decisions

- Phase 1 lives in the Architecture group, not the Workbench.
- The cross-flow edge Inventory Lot → Advance Ship Notice is stored in
  `relationships` like any other lineage edge. The Data view stays scoped to one
  flow, so it is followed by the recall trace and lot coverage, not by the
  per-flow lineage view.

## 16. Roadmap priority

1. Recall notice as a Workbench case with steward/operator approval.

## 17. Follow-ups

- Unit-level serial tracing; DSCSA-style transaction history for drug products.
