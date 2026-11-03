---
status: draft
owner: demo-team
created: 2026-11-03
updated: 2026-11-03
release_type: product measurement
baseline_tag: none
depends_on: []
amends: []
---

# Demo Outcome Targets Spec

## 1. Problem

No spec defines what "better" means for the demo. Goals say "fast", "clear", or
"answer-first", but nothing is measured, so later changes (for example,
simplifying the Workbench) can't show they helped, and a slow cluster or a
regression in clicks goes unnoticed until a live session.

## 2. Users and audience

- Primary user: demo-team deciding what to change next.
- Secondary users: the presenter checking readiness before a session.
- Demo audience: indirectly, every audience.

## 3. Goals

- A short list of targets for the three hero questions, each with a number.
- Each target checked automatically where possible, in rehearsal otherwise.
- A baseline recorded today, so future specs can compare against it.

## 4. Product outcomes

- Every future UX spec states which target it moves.
- The presenter has a pass/fail readiness check before a session.

## 5. Demo success criteria

- `npm run smoke` prints per-question timings and fails when a budget is exceeded.
- Click paths for the hero questions are covered by frontend tests.

## 6. Non-goals

- Real-user analytics or telemetry.
- Load testing or production latency SLOs.
- Changing any screen to meet a target (later specs do that).

## 7. Requirements

Hero questions (from `DEMO.md`):
**Q1** Operations: which business process is hit by this alert, who owns it,
and what's the next safe check? **Q2** Recall: which hospitals received lot
L-2291? **Q3** Lineage: where did PO-1 go, end to end?

- **REQ-001:** The spec shall record, per question, a click target and an API
  time budget (section 15), set from a measured baseline.
- **REQ-002:** `npm run smoke` shall time the API call behind each question
  (investigation, recall trace, order trace) and print the timings.
- **REQ-003:** `npm run smoke` shall fail when a timing exceeds its budget,
  naming the question, the time, and the budget.
- **REQ-004:** Frontend tests shall walk each question's click path from the
  screen's landing state to the answer and assert the click count is within
  target.
- **REQ-005:** `DEMO.md` shall list the targets and a pre-session check
  ("run `npm run smoke`; all budgets pass").
- **REQ-006:** The spec template shall gain a line "Targets moved: Qn or none".

## 8. UX design

No UI change. Smoke output gains a block, for example:
`[targets] Q1 investigation 1.4 s (budget 3 s) · Q2 recall 0.6 s (2 s) · Q3 order trace 0.5 s (2 s)`.

## 9. Data and API design

No API change. Timings are measured client-side in `scripts/full-smoke.mjs`
with `performance.now()` around existing calls; budgets live in one constant.

## 10. MongoDB usage

Indirect: budgets cover `$graphLookup` traversal, Atlas Search and vector
retrieval as served from the configured cluster.

## 11. Acceptance criteria

- [ ] REQ-001 — manual: baseline and targets recorded in section 15, by demo-team
- [ ] REQ-002 — automated: `scripts/full-smoke.mjs` prints `[targets]`
- [ ] REQ-003 — automated: `scripts/full-smoke.mjs` assertion tagged per question
- [ ] REQ-004 — automated: `InvestigationWorkbench.test.jsx`, `RecallTrace.test.jsx`, `LineageView.test.jsx`
- [ ] REQ-005 — manual: `DEMO.md` reviewed, by demo-team
- [ ] REQ-006 — manual: `specs/template.md` reviewed, by demo-team

## 12. Product risks

- Timings vary with network and cluster tier; budgets too tight cause flaky
  smoke runs, too loose catch nothing. Budgets start at about 2× baseline.
- Click counts in tests can drift from the real UI if tests use shortcuts.
- First call after a reseed is slower; the smoke run measures after one warm-up call.

## 13. Validation plan

- Unit/API checks: none new.
- Frontend checks: `cd frontend && npm test`.
- Smoke checks: `npm run smoke` on Atlas and on Atlas Local; both under budget.
- Demo rehearsal checks: time Q1–Q3 by hand once and compare with the targets.

## 14. Implementation tasks

- [ ] Measure the baseline: 5 smoke runs on Atlas, 5 on Atlas Local; count clicks per question.
- [ ] Fill section 15; get the numbers approved before enforcing them.
- [ ] Smoke timings, warm-up call, budget assertions.
- [ ] Click-path tests for Q1–Q3.
- [ ] `DEMO.md` targets and pre-session check; template line.

## 15. Decisions

- Targets (proposed, to be replaced by measured values before `accepted`):
  Q1 ≤ 3 clicks, API ≤ 3 s · Q2 ≤ 1 click, API ≤ 2 s · Q3 ≤ 3 clicks, API ≤ 2 s.
- Budgets fail the smoke run rather than warn: a readiness check that only
  warns gets ignored.

## 16. Roadmap priority

1. Baseline and targets (REQ-001).
2. Smoke timings and budgets (REQ-002, REQ-003).
3. Click-path tests and docs (REQ-004–REQ-006).

## 17. Follow-ups

- Show per-question timing in Presenter Console.
