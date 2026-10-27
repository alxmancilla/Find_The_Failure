# UX Clarity Spec

---
status: implemented
owner: demo-team
created: 2026-10-27
updated: 2026-10-27
release_type: UX polish
baseline_tag: TBD
---

## 1. Problem

The architecture views answer the right questions but bury the answer: the Data
view right panel stacks seven sections, the toolbar has three rows of identical
pill buttons, an active "as of" date is easy to miss, trust status relies on
colour alone, and much of the text is 9–11px, which is hard to read on a
projector. Some navigation hints are stale after procure-to-pay and recall.

## 2. Users and audience

- Primary user: presenter running the architecture path.
- Secondary users: architects and data stewards exploring on their own.
- Demo audience: viewers reading the screen from a projector.

## 3. Goals

- Lead each architecture screen with a one-line answer.
- Make the active flow, entity, direction, and date obvious.
- Make trust and status readable without colour.
- Raise the minimum text size.

## 4. Product outcomes

- The presenter can read the answer aloud from the top of the screen.
- No section the presenter needs is below the fold in the Data view.

## 5. Demo success criteria

- Data view shows a summary line above the graph and a tabbed right panel.
- Recall Trace shows the answer before the evidence.
- Setting a past date shows a banner with a way back to current.

## 6. Non-goals

- Workbench restructuring (triage vs case step).
- Cross-screen deep links, loading skeletons, and retry states.
- Presenter display scaling.

## 7. Requirements

- **REQ-001:** Navigation hints reflect both flows and Recall Trace.
- **REQ-002:** No CSS or inline font size below 12px.
- **REQ-003:** Graphs show a legend; inferred/at-risk/failed edges carry a text or
  icon cue and a dashed stroke in addition to colour.
- **REQ-004:** Animated edges and transitions respect `prefers-reduced-motion`.
- **REQ-005:** Data view shows an answer line above the graph: entity, connected
  documents, inferred edges needing review, and identifier coverage.
- **REQ-006:** Recall Trace shows an answer line (hospitals, on-hand units,
  untraceable receipts) and recommended actions before the evidence.
- **REQ-007:** The Data view right panel uses tabs: **Details** (entity and
  selected hop), **Trace** (follow the identifier), **Governance** (steward
  decisions and standards), **Proof** (MongoDB pipeline). Selecting an edge
  opens Details.
- **REQ-008:** When an "as of" date is set, a banner states the date and offers
  **Back to current**, in both the Data view and Recall Trace.
- **REQ-009:** Flow and direction controls are labelled radio groups with
  keyboard arrow support; direction buttons carry icons; entities are chosen
  from a labelled list in flow order.

## 8. UX design

- Answer line: one sentence, bold subject, chips for counts, warning chip for
  inferred edges.
- Tabs: ARIA `tablist` / `tab` / `tabpanel`; tab labels carry counts where useful.

## 9. Data and API design

No API changes; all values come from existing responses.

## 10. MongoDB usage

Unchanged. The MongoDB proof moves to its own tab.

## 11. Acceptance criteria

- [ ] REQ-001 to REQ-009 visible in the running demo (pending a manual visual pass).
- [x] `cd frontend && npm run build` passes.
- [x] `npm run smoke` passes with unchanged results.

## 12. Product risks

- Larger text may wrap in the header and Workbench side panels; check at
  1280px and 1100px widths.

## 13. Validation plan

- Build, smoke, and a manual pass through the architecture path.

## 14. Implementation tasks

- [x] Stale hints, font floor, legend, reduced motion.
- [x] Answer lines in Data view and Recall Trace.
- [x] Tabbed Data view panel.
- [x] As-of banner and clearer controls.
- [x] Docs and spec status.

## 15. Decisions

- Items 5–7 of the UX review (deep links, states, Workbench split) are deferred.

## 16. Roadmap priority

1. Cross-screen links (Recall → Lineage, Trace → Workbench).
2. Loading, empty, and retry states.
3. Workbench triage / case split.

## 17. Follow-ups

- Presenter display scaling switch.
