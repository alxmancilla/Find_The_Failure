---
status: draft
owner: demo-team
created: 2026-11-03
updated: 2026-11-03
release_type: product value
baseline_tag: none
depends_on: [product-recall-traceability]
amends: []
---

# Recall Actions Spec

## 1. Problem

Recall Trace answers "which hospitals received lot L-2291?" but stops there.
The recommended actions are plain sentences ("Quarantine 120 on-hand units…",
"Notify …"). A quality or regulatory lead's next step is to notify each
hospital, quarantine stock, and keep a record; today they would retype
everything the screen already knows.

## 2. Users and audience

- Primary user: quality / regulatory affairs lead running a recall.
- Secondary users: supply-chain operations (quarantine), customer service.
- Demo audience: business and architecture stakeholders.

## 3. Goals

- Turn the answer into ready-to-use, reviewable outputs.
- Keep everything local and read-only: nothing is sent or changed.

## 4. Product outcomes

- One notification draft per affected hospital, with its orders, shipments, and units.
- A quarantine summary with the on-hand quantity.
- An export of the affected-hospital list for the recall record.

## 5. Demo success criteria

- From the recall answer, the presenter opens a hospital's draft notice and
  downloads the hospital list in under 3 clicks.
- Targets moved ([`demo-outcome-targets`](../demo-outcome-targets/spec.md)): none.

## 6. Non-goals

- Sending email, creating tickets, or changing inventory.
- Regulatory submissions (FDA/DSCSA reports).
- Hospital contact data (not in the sample; see decisions).

## 7. Requirements

- **REQ-001:** The recall response shall include, per affected hospital, a
  notification draft: subject and body naming the product, lot, UDI-DI, recall
  class and reason, that hospital's orders, shipments, units, and last ship date.
- **REQ-002:** The response shall include a quarantine summary: lot, on-hand
  units, receipts the stock came from, and units that cannot be traced by lot.
- **REQ-003:** The screen shall show an "Actions" section with one row per
  hospital (open draft, copy to clipboard) and the quarantine summary.
- **REQ-004:** The screen shall offer "Download hospital list (CSV)" with
  hospital, orders, shipments, units, last shipped, built in the browser.
- **REQ-005:** Every action shall carry the existing read-only guardrail, and the
  backend shall not write anything for these actions.
- **REQ-006:** Drafts and the summary shall respect the "Mappings as of" date
  already applied to the trace.

## 8. UX design

Below the answer line: **Actions** — a table of hospitals with "View notice" and
"Copy" buttons; a quarantine card (`120 units on hand · from GR-…`); a
"Download hospital list (CSV)" button. The draft opens inline in a
`<details>`; no modal.

## 9. Data and API design

- `GET /recalls/:recallId` gains `actions: { notifications: [{ ship_to, subject,
  body, orders, shipments, units }], quarantine: { lot_number, on_hand,
  source_receipts, untraceable_units } }`. Existing fields unchanged.
- No new collection or write.

## 10. MongoDB usage

Built from the existing lot aggregation over `message_events`; the MongoDB
proof panel stays as is.

## 11. Acceptance criteria

- [ ] REQ-001 — automated: `scripts/full-smoke.mjs` (3 notifications for RCL-2026-014)
- [ ] REQ-002 — automated: `scripts/full-smoke.mjs` (on_hand 120, untraceable units 250)
- [ ] REQ-003 — automated: `RecallTrace.test.jsx`
- [ ] REQ-004 — automated: `RecallTrace.test.jsx` (CSV content)
- [ ] REQ-005 — automated: `scripts/full-smoke.mjs` (no document count changes)
- [ ] REQ-006 — automated: `scripts/full-smoke.mjs` (as-of request)

## 12. Product risks

- Drafts may read as legal text; label them "Draft for review".
- Without contacts, "notify" stops at a draft; the decision below may change that.

## 13. Validation plan

- Unit/API checks: smoke assertions above.
- Frontend checks: `cd frontend && npm test`, `npm run build`.
- Demo rehearsal checks: Recall Trace path in `DEMO.md`, CSV opens in a spreadsheet.

## 14. Implementation tasks

- [ ] Build `actions` in `lineageIdentifiers.js` from the existing trace.
- [ ] Actions section, copy, and CSV export in `RecallTrace.jsx`.
- [ ] Smoke and component tests; `DEMO.md` and `DATA_MODEL.md` updates.

## 15. Decisions

- **Open:** add sample hospital contacts (a small `customers` seed, so drafts
  show a recipient), or keep drafts recipient-less. Default: recipient-less.

## 16. Roadmap priority

1. REQ-001, REQ-003 (notification drafts).
2. REQ-002, REQ-004 (quarantine, export).
3. REQ-005, REQ-006.

## 17. Follow-ups

- Behind a setting, create one ticket per hospital in an ITSM or CRM tool.
