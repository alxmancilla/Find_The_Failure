---
status: accepted
owner: demo-team
created: 2026-10-31
updated: 2026-10-31
release_type: platform hardening
baseline_tag: none
depends_on: []
amends: []
---

# Bounded History Arrays Spec

## 1. Problem

Six history arrays grow with every `$push` and have no limit: steward
`review_history` on relationships, alert `workbench_lifecycle.history` on
source records, and the case `timeline`, `messages`, `approval_decisions`, and
`case_outcomes`. Unbounded arrays are a MongoDB anti-pattern: documents grow
toward the 16 MB limit and every update rewrites more data.

## 2. Users and audience

- Primary: MongoDB SAs and architects reviewing the data model.
- Secondary: presenters running long rehearsals on one case.

## 3. Goals

- Cap every history array at a documented size, keeping the newest entries.
- Keep current-state fields (`review`, `approval_state`, `case_outcome`,
  `workbench_lifecycle.status`) unchanged.

## 4. Product outcomes

- Document size stays bounded regardless of how often a case is updated.

## 5. Demo success criteria

- Smoke results unchanged (smoke stays well below every cap).

## 6. Non-goals

- Moving history into separate collections.
- Bounding the embedded `investigation_result` snapshot.

## 7. Requirements

- **REQ-001:** Caps are defined in one module: `review_history` 20,
  `workbench_lifecycle.history` 20, case `timeline` 100, `messages` 50,
  `approval_decisions` 20, `case_outcomes` 20.
- **REQ-002:** Every `$push` to these arrays uses `$each` with `$slice: -<cap>`,
  so the newest entries are kept in order.
- **REQ-003:** Steward review history is capped at 20 entries.
- **REQ-004:** Alert lifecycle history is capped at 20 entries.
- **REQ-005:** Case `timeline`, `messages`, `approval_decisions`, and
  `case_outcomes` are capped at their limits.
- **REQ-006:** `DATA_MODEL.md` documents each cap.

## 8. UX design

None. Counts shown in the UI ("n decisions") never exceed the cap.

## 9. Data and API design

No API changes. Arrays already over a cap are trimmed on their next update.

## 10. MongoDB usage

`$push` with `$each` / `$slice` (bounded array; newest entries kept).

## 11. Acceptance criteria

- [ ] REQ-002–REQ-005 — automated: `backend/test/history-limits.test.mjs`
  (pushes past each cap and checks length and newest-last order).
- [ ] REQ-001, REQ-006 — manual: code and doc review, by demo-team.
- [ ] `npm run smoke` passes with unchanged results.

## 12. Product risks

- A long follow-up conversation loses its oldest messages after 25 questions.

## 13. Validation plan

`cd backend && npm test`, `npm run smoke`, `npm run spec:check`.

## 14. Implementation tasks

- [ ] Caps module and `$slice` on every push.
- [ ] History limit tests.
- [ ] Docs and spec status.

## 15. Decisions

- Accepted in advance by the demo owner on 2026-10-31; the draft was not
  reviewed separately.

## 16. Roadmap priority

1. History collections if full audit retention is required.

## 17. Follow-ups

- Bound or externalize `investigation_result`.
