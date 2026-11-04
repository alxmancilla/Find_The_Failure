---
status: draft
owner: demo-team
created: 2026-11-03
updated: 2026-11-03
release_type: UX
baseline_tag: none
depends_on: [navigation-routing]
amends: [demo-outcome-targets]
---

# Order Trace Shortcut Spec

## 1. Problem

Q3 ("Where did this order go, end to end?") takes 4 clicks from the landing
screen: **Catalog & Lineage** → **Data view** → **Trace** tab → pick the order.
The order picker is hidden inside a tab of a lens the screen doesn't open by
default, so a user who doesn't already know the path won't find it.

## 2. Users and audience

- Primary user: operations analyst or architect asked about one order or supplier PO.
- Secondary users: the presenter.
- Demo audience: architecture and operations.

## 3. Goals

- Trace an order in 2 clicks from the landing screen.
- Keep the System view as the Catalog & Lineage default.

## 4. Product outcomes

- "Trace an order" is visible as soon as Catalog & Lineage opens.
- Each trace has a shareable URL (via `navigation-routing`).

## 5. Demo success criteria

- **Catalog & Lineage** → pick an order → the trace shows.
- Targets moved ([`demo-outcome-targets`](../demo-outcome-targets/spec.md)): Q3
  4 → 2 clicks; API budget unchanged.

## 6. Non-goals

- Free-text order search (the sample has a fixed set of orders).
- Changing the Trace tab or the trace response.

## 7. Requirements

- **REQ-001:** Catalog & Lineage (System view) shall show a "Trace an order"
  picker listing sample transactions from both flows, grouped by flow, with
  their status.
- **REQ-002:** Picking a transaction shall open the Data view on that flow, the
  flow's entry entity, and the Trace tab with the transaction selected, using
  the `#/lineage?flow=…&entity=…&transaction=…` URL.
- **REQ-003:** The picker shall show a loading state, and an inline error with
  Retry if transactions fail to load.
- **REQ-004:** The Q3 click-path test shall assert ≤ 2 clicks from the landing
  screen, and `demo-outcome-targets` and `DEMO.md` shall record Q3 = 2.

## 8. UX design

A compact row under the lens toggle: label "Trace an order", a select with
option groups "Order to Cash" and "Procure to Pay" (`PO-… · failed`). Selecting
navigates; no extra button.

## 9. Data and API design

No API change: uses `GET /lineage/flows/:flow/transactions` for each flow.
Entry entity per flow: `purchase-order` (order-to-cash), `supplier-purchase-order`
(procure-to-pay), the first business document in each flow's `entity_order`.

## 10. MongoDB usage

Unchanged: the trace uses the business-key attribute index on `message_events`.

## 11. Acceptance criteria

- [ ] REQ-001 — automated: `frontend/src/components/Explorer.test.jsx`
- [ ] REQ-002 — automated: `Explorer.test.jsx` (calls the open-lineage handler with flow, entity, transaction)
- [ ] REQ-003 — automated: `Explorer.test.jsx`
- [ ] REQ-004 — automated: Q3 click-path test; manual: `DEMO.md` reviewed, by demo-team

## 12. Product risks

- One more control on the System view; keep it a single row.
- Two API calls on load; both are small.

## 13. Validation plan

- Frontend checks: `cd frontend && npm test`, `npm run build`.
- Smoke checks: `npm run smoke`.
- Demo rehearsal checks: trace PO-4500012388 (held) and one supplier PO.

## 14. Implementation tasks

- [ ] Picker component in `Explorer.jsx` using the existing `onOpenLineage`-style navigation.
- [ ] `Explorer.test.jsx` (new) and Q3 test update.
- [ ] `demo-outcome-targets` amendment and `DEMO.md` table.

## 15. Decisions

- Put the shortcut on the System view rather than making the Data view the
  default, so the architecture story still opens on the dependency graph.

## 16. Roadmap priority

1. REQ-001, REQ-002.
2. REQ-003, REQ-004.

## 17. Follow-ups

- The same shortcut for lots (jump to Recall Trace) if a second recall is seeded.
