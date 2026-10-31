---
status: draft
owner: demo-team
created: YYYY-MM-DD
updated: YYYY-MM-DD
release_type: TBD
baseline_tag: none
depends_on: []
amends: []
---

# <Feature Name> Spec

<!--
Front matter rules (checked by `npm run spec:check`):
- status: draft | accepted | implemented | validated | superseded
- updated: bump when requirements, decisions, or status change
- baseline_tag: an existing git tag, or `none`
- depends_on / amends / supersedes: spec folder names; the target spec must list
  this spec in amended_by / superseded_by
-->


## 1. Problem

What user or demo problem are we solving?

## 2. Users and audience

- Primary user:
- Secondary users:
- Demo audience:

## 3. Goals

- Goal 1
- Goal 2
- Goal 3

## 4. Product outcomes

- Outcome 1
- Outcome 2
- Outcome 3

## 5. Demo success criteria

- Success criterion 1
- Success criterion 2
- Success criterion 3

## 6. Non-goals

- Non-goal 1
- Non-goal 2

## 7. Requirements

Use stable IDs so implementation and tests can reference them.

- **REQ-001:** The system shall ...
- **REQ-002:** When ..., the user shall be able to ...
- **REQ-003:** If ..., the system shall ...

## 8. UX design

Describe the intended user flow, labels, empty states, and interaction model.

## 9. Data and API design

List impacted collections, API endpoints, response fields, and seed data.

## 10. MongoDB usage

Describe which MongoDB capabilities are part of the story, such as Atlas Search,
Vector Search, `$graphLookup`, aggregation, flexible documents, or case memory.

## 11. Acceptance criteria

Each criterion names how it is checked: an automated test that references the
requirement as `[<spec>:REQ-001]`, or a manual check with an owner.

- [ ] REQ-001 — automated: `<test file>`
- [ ] REQ-002 — manual: <what is checked>, by <owner>

## 12. Product risks

- Risk 1:
- Risk 2:
- Risk 3:

## 13. Validation plan

- Unit/API checks:
- Frontend checks:
- Smoke checks:
- Demo rehearsal checks:

## 14. Implementation tasks

- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

## 15. Decisions

- Decision 1:

## 16. Roadmap priority

1. Priority 1:
2. Priority 2:
3. Priority 3:

## 17. Follow-ups

- Follow-up 1: