---
status: draft
owner: demo-team
created: 2026-11-03
updated: 2026-11-03
release_type: UX
baseline_tag: none
depends_on: [demo-outcome-targets]
amends: []
---

# Workbench Answer First Spec

## 1. Problem

The Workbench already collapses supporting evidence under the Investigation
summary card and starts in Presenter Mode. What remains:

- **The answer sits in a 380px side rail**, below the step tabs, while the main
  column leads with the Next best action card, the case header and stats, and
  the topology graph. The first thing the eye lands on is not the answer.
- **The same action appears three times:** "Open investigation case" is a
  primary button in the selected-alert panel, the summary card, and the Next
  best action card.
- **Guidance appears four times:** the demo hint, the Recommended flow
  (`GuidedPath`), Presenter Mode text, and the Next best action card.

## 2. Users and audience

- Primary user: integration support engineer triaging an alert.
- Secondary users: the presenter.
- Demo audience: operations and architecture.

## 3. Goals

- After an investigation, the answer (impact, owner, likely issue, next safe
  check) is the first thing in the main column.
- One primary call to action at a time.
- One guidance element.

## 4. Product outcomes

- The Q1 answer is readable without scrolling at 1280 × 800.
- The screen has fewer competing elements before the answer.

## 5. Demo success criteria

- Presenter can point to one card and read Q1's answer aloud.
- Targets moved ([`demo-outcome-targets`](../demo-outcome-targets/spec.md)): Q1 —
  clicks unchanged (1); the answer moves above the fold.

## 6. Non-goals

- New panels, data, or API fields.
- Changes to the Case step (handoff, follow-up, approval, closure).
- Removing Presenter Mode or the detailed mode.

## 7. Requirements

- **REQ-001:** When an investigation result exists, the main column shall show
  the answer card first: impact, owner, likely issue with confidence, and next
  safe check, above the graph and case stats.
- **REQ-002:** Before an investigation, the answer card's place shall show the
  selected alert and a single "Open investigation case" primary button.
- **REQ-003:** "Open investigation case" shall be a primary button in exactly one
  place; other places shall use a secondary style or be removed.
- **REQ-004:** The Next best action card shall be the only always-visible
  guidance; the demo hint and Recommended flow shall move into a collapsed
  "Presenter guide" disclosure in the inbox.
- **REQ-005:** The right rail keeps the Triage/Case steps; on Triage it shows the
  collapsed supporting evidence, not a second copy of the summary.
- **REQ-006:** At 1280 × 800 with an investigation result, the answer card shall
  be fully visible without scrolling.

## 8. UX design

Main column, top to bottom: Next best action (one line) → answer card →
topology graph → playbook/proof disclosure. Right rail: step tabs → supporting
evidence (collapsed) → "Continue to case →". Inbox: alert list first, demo
controls and the Presenter guide collapsed below.

## 9. Data and API design

No change. Uses the existing investigation response.

## 10. MongoDB usage

Unchanged; the MongoDB proof stays one click away.

## 11. Acceptance criteria

- [ ] REQ-001 — automated: `InvestigationWorkbench.test.jsx` (answer card precedes the graph in document order)
- [ ] REQ-002 — automated: `InvestigationWorkbench.test.jsx`
- [ ] REQ-003 — automated: `InvestigationWorkbench.test.jsx` (one primary "Open investigation case")
- [ ] REQ-004 — automated: `InvestigationWorkbench.test.jsx` (guide collapsed by default)
- [ ] REQ-005 — automated: `InvestigationWorkbench.test.jsx`
- [ ] REQ-006 — manual: 1280 × 800 visual check, by demo-team

## 12. Product risks

- `DEMO.md` steps reference the current positions; they must be updated.
- Moving the summary out of the rail may make the rail feel empty on Triage.
- Existing `ux-clarity` and `workbench-simplification` tests may assert the
  current layout and need updating.

## 13. Validation plan

- Frontend checks: `cd frontend && npm test`, `npm run build`.
- Smoke checks: `npm run smoke` (unchanged API; Q1 click test still ≤ 1).
- Demo rehearsal checks: `DEMO.md` hero path at 1280 × 800 and 1100 px.

## 14. Implementation tasks

- [ ] Move `InvestigationSummaryCard` to the top of `workbench-center`.
- [ ] Single primary CTA; secondary style elsewhere.
- [ ] Collapse demo hint + `GuidedPath` into a "Presenter guide" disclosure.
- [ ] Update tests and `DEMO.md` hero path wording.

## 15. Decisions

- Structure only; no new features (per the product review).

## 16. Roadmap priority

1. REQ-001, REQ-003 (answer first, one CTA).
2. REQ-004, REQ-005 (less guidance noise).
3. REQ-006 (fold check).

## 17. Follow-ups

- Usability sessions with 3–5 support engineers before further Workbench changes.
