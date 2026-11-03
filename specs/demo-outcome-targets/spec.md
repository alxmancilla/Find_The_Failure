---
status: implemented
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

- `npm run smoke` prints per-question timings and warns when a budget is exceeded.
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
- **REQ-003:** `npm run smoke` shall print a warning when a timing exceeds its
  budget, naming the question, the time, and the budget, without failing the run.
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

- [x] REQ-001 — manual: baseline and targets recorded in section 15, approved 2026-11-03, by demo-team
- [x] REQ-002 — automated: `scripts/full-smoke.mjs` prints `[targets]`
- [x] REQ-003 — automated: `scripts/full-smoke.mjs` budget check tagged per question (warning only)
- [x] REQ-004 — automated: `InvestigationWorkbench.test.jsx`, `RecallTrace.test.jsx`, `LineageView.test.jsx`
- [ ] REQ-005 — manual: `DEMO.md` reviewed, by demo-team
- [ ] REQ-006 — manual: `specs/template.md` reviewed, by demo-team

## 12. Product risks

- Timings vary with network and cluster tier; budgets too tight cause noisy
  warnings, too loose catch nothing. Budgets start at about 2× baseline.
- Warnings can be overlooked; the pre-session check in `DEMO.md` says to read them.
- Click counts in tests can drift from the real UI if tests use shortcuts.
- First call after a reseed is slower; the smoke run measures after one warm-up call.

## 13. Validation plan

- Unit/API checks: none new.
- Frontend checks: `cd frontend && npm test`.
- Smoke checks: `npm run smoke` on Atlas and on Atlas Local; both under budget.
- Demo rehearsal checks: time Q1–Q3 by hand once and compare with the targets.

## 14. Implementation tasks

- [x] Measure the baseline on Atlas (2 runs × 5 calls) and count clicks per question.
- [x] Measure the baseline on Atlas Local (fresh clone, 2 first-run starts).
- [x] Fill section 15; get the numbers approved before enforcing them.
- [x] Smoke timings (warm-up call, median of 3), budget warnings.
- [x] Click-path tests for Q1–Q3.
- [x] `DEMO.md` targets and pre-session check; template line.

## 15. Decisions

- Baseline, Atlas, 2026-11-03 (warm median of 5 calls, 2 runs): Q1 2.0–2.2 s,
  Q2 0.33–0.36 s, Q3 0.45–0.47 s. Atlas Local (same machine, keyword search,
  no embeddings): Q1 ~0.1 s, Q2 ~4 ms, Q3 ~3 ms, so the budgets are set by Atlas
  network latency, not the database work. Clicks from the landing screen (Workbench):
  Q1 1 (**Open investigation case**), Q2 1 (**Recall Trace**), Q3 4
  (**Catalog & Lineage**, **Data view**, **Trace**, pick the order).
- Targets (approved 2026-11-03): API budgets Q1 4.5 s · Q2 0.75 s · Q3 1 s
  (about 2× baseline). Click targets equal the baseline (no regression): Q1 ≤ 1,
  Q2 ≤ 1, Q3 ≤ 4. Q3 is above the 3 clicks first proposed; reducing it is a
  candidate for a later UX spec.
- Component tests count clicks inside the screen; the navigation clicks before
  the screen loads are added to reach the totals above.
- Budgets warn, not fail (approved 2026-11-03): network and cluster variance
  should not block a rehearsal; functional assertions still fail the run.

## 16. Roadmap priority

1. Baseline and targets (REQ-001).
2. Smoke timings and budgets (REQ-002, REQ-003).
3. Click-path tests and docs (REQ-004–REQ-006).

## 17. Follow-ups

- Show per-question timing in Presenter Console.
