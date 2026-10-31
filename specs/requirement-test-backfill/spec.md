---
status: validated
owner: demo-team
created: 2026-10-31
updated: 2026-10-31
release_type: quality
baseline_tag: requirement-test-backfill-2026-10-31
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

- [x] REQ-001 — automated: `npm run spec:check` shows the tagged coverage
  (28 → 131 of 181 requirements).
- [x] REQ-002, REQ-003 — automated: `cd backend && npm test` passes (21 tests).
- [x] REQ-004 — manual: section 18 matches `spec:check`, by demo-team (done by
  the agent on 2026-10-31).

## 12. Product risks

- Backend tests touch the shared demo database; each test must restore state.

## 13. Validation plan

`npm run smoke`, `cd backend && npm test`, `npm run spec:check`.

## 14. Implementation tasks

- [x] Tag smoke assertions.
- [x] Backend test suite and script.
- [x] Untested-requirement list.

## 15. Decisions

- Accepted in advance by the demo owner on 2026-10-31; the draft was not
  reviewed separately.

## 16. Roadmap priority

1. Component tests for the older Workbench UI requirements.

## 17. Follow-ups

- Replace `backend/smoke.mjs` with assertions or remove it.

## 18. Untested requirements

Requirements in `validated` specs with no automated test reference after this
backfill (2026-10-31), and why:

| Spec | Requirements | Reason |
|---|---|---|
| `operations-workbench` | REQ-003, REQ-005, REQ-006, REQ-007, REQ-009, REQ-019 | UI-only (demo controls, guided path, playbook phases, stage panel, priority card, Presenter Mode) |
| `operational-priority` | REQ-001–REQ-006 | UI-only; priority is derived in the frontend |
| `workbench-simplification` | REQ-001–REQ-004 | UI-only |
| `alert-deduplication` | REQ-003 | UI-only (signal count on alert cards) |
| `alert-lifecycle` | REQ-002, REQ-007 | UI-only |
| `change-correlation` | REQ-004 | UI-only |
| `change-correlation` | REQ-006 | Gap: evidence mentions changes, but no smoke case is built from a fixture alert, so the follow-up half is unchecked |
| `change-correlation` | REQ-007 | Process: read-only by design; there is no outbound client in the backend |
| `grounded-follow-up-qa` | REQ-004 | UI-only |
| `similar-case-retrieval` | REQ-004 | UI-only |
| `itsm-handoff-preview` | REQ-007 | Process: no external calls (see `change-correlation` REQ-007) |
| `operator-approval-decision-log` | REQ-006, REQ-007 | REQ-006 UI-only; REQ-007 process |
| `case-closure-outcomes` | REQ-007, REQ-008 | REQ-007 UI-only; REQ-008 process |
| `architecture-integrity` | REQ-007, REQ-008 | UI-only (navigation groups, Plan-a-change link) |
| `operational-lineage` | REQ-003, REQ-005 | Amended by `architecture-integrity` (lineage no longer on interfaces) |
| `operational-lineage` | REQ-008 | UI-only (System view / Data view lens) |
| `lineage-governance` | REQ-001 | Amended by `business-key-attribute-pattern` (index); the collection is exercised by REQ-002 tests |
| `procure-to-pay` | REQ-008 | UI-only (flow picker; the component test mocks a single flow) |
| `product-recall-traceability` | REQ-010 | Amended by `business-key-attribute-pattern` |
| `mongodb-transactions` | REQ-002, REQ-003, REQ-004 | Manual code review (recorded in that spec) |
| `bounded-history-arrays` | REQ-001, REQ-006 | Manual code and doc review (recorded in that spec) |
| `requirement-test-backfill` | REQ-001–REQ-004 | Process: checked by running `spec:check` and `npm test` |

UI-only requirements are the candidates for the roadmap item below.
