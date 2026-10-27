# Procure-to-Pay Lineage Spec

---
status: validated
owner: demo-team
created: 2026-10-27
updated: 2026-10-27
release_type: architecture demo extension
baseline_tag: TBD
---

## 1. Problem

The demo traces only the customer side (order-to-cash). Architects will ask
whether the model generalizes, and the supplier side of the same business is
half-modeled: Supplier Replenishment, the outbound supplier 850, and Supplier EDI
exist, but nothing after the purchase order is sent.

## 2. Users and audience

- Primary user: enterprise / integration architect.
- Secondary users: accounts-payable and procurement operations.
- Demo audience: architecture stakeholders asking "does this work for another flow?"

## 3. Goals

- Add procure-to-pay as a second lineage flow defined as data.
- Prove a new flow needs seed data, not lineage-service code.
- Mirror order-to-cash: Apex is the buyer instead of the seller.

## 4. Product outcomes

- Architects can trace a supplier PO from reorder trigger to supplier payment.
- Three-way match (PO, receipt, invoice) is visible as the control point.
- The Data view switches between flows without new screens.

## 5. Demo success criteria

- Selecting **Procure to Pay** shows Purchase Requisition through Supplier Payment.
- The supplier PO number is mapped on every hop.
- A sample supplier PO stopped at a three-way-match hold shows the documents not
  yet produced (payment, remittance).
- Order-to-cash results and the Workbench baseline are unchanged.

## 6. Non-goals

- No change to `if-inventory-supplier`, its dependency edges, or the Supplier
  Replenishment Workbench scenario.
- No real AP automation, banking, or payment execution.
- No new `depends_on` edges for the new interfaces (same choice as the
  order-to-cash cash interfaces).

## 7. Requirements

- **REQ-001:** Seed shall add the external supplier **Meridian Medical Supply**
  (`meridian-medical`) as a system reached through Supplier EDI.
- **REQ-002:** Seed shall add procure-to-pay entities: Purchase Requisition,
  Supplier Purchase Order, Supplier PO Acknowledgment, Supplier Ship Notice,
  Goods Receipt, Supplier Invoice, Invoice Match, and Supplier Payment, each with
  identifiers, system of record, and data owner.
- **REQ-003:** Seed shall add interfaces: inbound 855, inbound 856, goods receipt
  posting (Inventory Service → Apex ERP), inbound 810, and outbound 820 payment
  remittance.
- **REQ-004:** The existing `if-inventory-supplier` interface shall be described
  in lineage as Purchase Requisition → Supplier Purchase Order, without changing
  the interface document.
- **REQ-005:** Lineage shall be ingested as `source_records` (catalog rows plus an
  entity-master export) in a new fixture group, including one internal
  three-way-match step asserted without an interface.
- **REQ-006:** A second `lineage_flows` document `procure-to-pay` shall define the
  identifier `supplier_po_number`, entity order, and path.
- **REQ-007:** Flow membership shall come from `lineage_flows.entity_order`, not
  `data_entities.domain`, so an entity can belong to more than one flow.
- **REQ-008:** The Data view shall offer a flow picker; the default entity and
  the "Follow the …" label shall come from the selected flow.
- **REQ-009:** `message_events` shall include two sample supplier POs: one
  completed through payment, one held at three-way match for a quantity variance.
- **REQ-010:** Transaction tracing shall support an `on_hold` status that blocks
  downstream hops like a failure.
- **REQ-011:** A business process **Supplier Invoice and Payment** shall map the
  new AP interfaces.

## 8. UX design

- Data view toolbar: **Flow** picker (Order to Cash / Procure to Pay) before the
  entity buttons.
- "Follow the supplier PO number" panel with the same sample-order picker.
- Modernization of Apex ERP lists procure-to-pay transformations alongside
  order-to-cash ones, labelled by flow.

## 9. Data and API design

- New fixture group `p2p-lineage-catalog`; identifier field `supplier_po_number`.
- No new endpoints; existing `?flow=` parameters select the flow.
- `getSystemLineageImpact` aggregates across all flows and tags each item with
  its flow.

## 10. MongoDB usage

- The same `$graphLookup` lineage pipeline over a second flow, with no code changes.
- Flow documents drive membership and ordering.
- Business-key index extended to `business_keys.supplier_po_number`.

## 11. Acceptance criteria

- [x] `GET /api/lineage/flows` lists two flows.
- [x] Purchase Requisition downstream lineage reaches Supplier Payment.
- [x] Every procure-to-pay hop maps `supplier_po_number`.
- [x] Held supplier PO trace stops at Invoice Match with payment at risk.
- [x] Order-to-cash lineage, governance, and Workbench smoke results unchanged.
- [x] No lineage-service changes beyond flow membership (REQ-007).

## 12. Product risks

- Two flows double the Data view content; keep one flow visible at a time.
- "Supplier EDI" vs "Meridian Medical Supply" could confuse; label Supplier EDI as
  Apex's channel and Meridian as the trading partner.

## 13. Validation plan

- `cd frontend && npm run build`; `npm run smoke` with procure-to-pay assertions.
- Rehearse a two-minute "same model, second flow" walkthrough.

## 14. Implementation tasks

- [x] Supplier system, entities, interfaces, and process.
- [x] Lineage catalog fixture and flow document.
- [x] Flow membership from `entity_order`; cross-flow modernization tagging.
- [x] `on_hold` trace status and sample supplier POs.
- [x] Data view flow picker; smoke, docs, and spec status.

## 15. Decisions

- Keep `if-inventory-supplier` unchanged to protect the Workbench scenario.
- Data impact for an ERP order-create failure now includes procure-to-pay
  documents (5 → 12 at risk), because the existing dependency graph already
  marks Supplier Replenishment as downstream. Dependency impact is unchanged.

## 16. Roadmap priority

1. Product recall traceability (depends on this spec).

## 17. Follow-ups

- Supplier scorecards from tracking latency and holds.
