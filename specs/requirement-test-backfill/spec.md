---
status: draft
owner: demo-team
created: 2026-10-31
updated: 2026-10-31
release_type: quality
baseline_tag: none
depends_on: [mongodb-transactions, bounded-history-arrays, business-key-attribute-pattern]
amends: []
---

# Requirement Test Backfill Spec

## 1. Problem

`npm run spec:check` shows 28 of 161 requirements referenced by tests; the 15
older validated specs show none. Many are already checked by
`scripts/full-smoke.mjs` but not tagged, and `mongodb-hygiene` has no automated
checks at all. `backend/smoke.mjs` prints results but asserts nothing.

## 2. Users and audience

- Primary: reviewers deciding whether "validated" can be trusted.
- Secondary: engineers changing behaviour covered by older specs.

## 3. Goals

- Tag every existing smoke assertion with the requirement it checks.
- Add backend tests where database behaviour has no check.
- Record why each remaining requirement has no automated test.

## 4. Product outcomes

- Every requirement in a validated spec is either tested or has a stated reason.

## 5. Demo success criteria

- Smoke results unchanged.

## 6. Non-goals

- New UI component tests for older Workbench requirements.
- Rewriting `backend/smoke.mjs`.

## 7. Requirements

- **REQ-001:** Smoke assertions that check a requirement reference it as
  `[<spec>:REQ-…]`; a tag is added only where the assertion checks the
  requirement's behaviour.
- **REQ-002:** A backend test suite (`backend/test`, Node test runner, real
  database) covers `mongodb-hygiene` validators, index cleanup, query scoping,
  index sync, and connection settings, and restores any state it changes.
- **REQ-003:** `cd backend && npm test` runs the suite; `spec:check` scans it.
- **REQ-004:** Section 18 of this spec lists each remaining untested
  requirement of a validated spec with its reason: UI-only, amended, or process.

## 8. UX design

None.

## 9. Data and API design

No changes.

## 10. MongoDB usage

`explain()`, `$documents` + `$jsonSchema`, `listIndexes`, `listCollections`.

## 11. Acceptance criteria

- [ ] REQ-001 — automated: `npm run spec:check` shows the tagged coverage.
- [ ] REQ-002, REQ-003 — automated: `cd backend && npm test` passes.
- [ ] REQ-004 — manual: section 18 matches `spec:check`, by demo-team.

## 12. Product risks

- Backend tests touch the shared demo database; each test must restore state.

## 13. Validation plan

`npm run smoke`, `cd backend && npm test`, `npm run spec:check`.

## 14. Implementation tasks

- [ ] Tag smoke assertions.
- [ ] Backend test suite and script.
- [ ] Untested-requirement list.

## 15. Decisions

- Accepted in advance by the demo owner on 2026-10-31; the draft was not
  reviewed separately.

## 16. Roadmap priority

1. Component tests for the older Workbench UI requirements.

## 17. Follow-ups

- Replace `backend/smoke.mjs` with assertions or remove it.

## 18. Untested requirements

To be completed during implementation.
