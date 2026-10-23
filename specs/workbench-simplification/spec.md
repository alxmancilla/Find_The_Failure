# Workbench Simplification / Presenter Mode Spec

---
status: validated
owner: demo-team
created: 2026-10-23
updated: 2026-10-23
release_type: demo UX refinement
baseline_tag: workbench-simplification-2026-10-23
---

## 1. Problem

The Workbench has strong evidence, case memory, handoff, lifecycle, dedupe, and
change-correlation features, but the default UI exposes too many cards at once.
This can make the demo feel more complex than the actual story.

## 2. Users and audience

- Primary user: demo presenter or integration support lead.
- Secondary users: operators and architects reviewing proof details.
- Demo audience: business, operations, platform, and MongoDB stakeholders.

## 3. Goals

- Lead with one executive investigation summary.
- Keep MongoDB proof and detailed evidence available on demand.
- Preserve all existing backend behavior and smoke coverage.

## 4. Product outcomes

- First-time viewers can understand priority, impact, owner, likely issue, why,
  and next safe check without scanning multiple cards.
- Technical buyers can expand proof panels when they ask how MongoDB grounded the
  answer.
- Presenters can run the hero path with less UI noise.

## 5. Demo success criteria

- The right rail defaults to a single summary-first story.
- Detailed playbook, MongoDB trace, evidence, changes, related context, similar
  cases, handoff, follow-up, and timeline are collapsed by default.
- Operator decisions remain visible because they are part of the human-in-loop
  close.

## 6. Non-goals

- No backend schema or API changes.
- No new external dependencies.
- No autonomous remediation, ticket creation, paging, or email side effects.

## 7. Requirements

- **REQ-001:** Presenter Mode shall be enabled by default and explain that it
  shows less by default while preserving proof on demand.
- **REQ-002:** The default right rail shall present one Investigation Summary card
  containing priority, impact, likely issue, owner, evidence rationale, and next
  safe check.
- **REQ-003:** MongoDB playbook proof shall remain accessible through an expandable
  panel.
- **REQ-004:** Supporting details shall be grouped under expandable sections.

## 8. UX design

The sidebar keeps the recommended flow and adds a compact Presenter Mode toggle.
The main canvas leads with the active alert and topology graph. The proof trail is
collapsed behind "Show investigation playbook and MongoDB proof." The right rail
starts with the consolidated Investigation Summary and keeps operator action
visible below it.

## 9. Data and API design

No API changes. The UI reuses existing investigation response fields, case
memory, alert dedupe metadata, related context, change correlation, handoff
preview, and lifecycle state.

## 10. MongoDB usage

MongoDB remains the proof layer. The UI moves proof to expandable panels rather
than changing queries, collections, or write behavior.

## 11. Acceptance criteria

- [x] Presenter Mode is visible and enabled by default.
- [x] Investigation Summary consolidates the most important answer fields.
- [x] MongoDB proof remains available on demand.
- [x] Supporting evidence remains available on demand.
- [x] Frontend build passes.
- [x] Full smoke passes.

## 12. Product risks

- Hiding proof by default may make technical buyers ask for details sooner; the
  presenter should open proof panels when asked.
- The summary can be mistaken as generated final root cause; copy should continue
  to frame findings as likely and human-reviewed.

## 13. Validation plan

- Frontend build: `cd frontend && npm run build`.
- Full smoke: `npm run smoke`.
- Manual check: load Workbench and confirm summary-first layout with collapsible
  proof/evidence sections.

## 14. Implementation tasks

- [x] Add Presenter Mode toggle.
- [x] Add consolidated Investigation Summary card.
- [x] Collapse MongoDB proof and supporting evidence by default.
- [x] Update README, DEMO runbook, and operations spec.

## 15. Decisions

- Keep operator action visible because human approval/closure is part of the hero
  story.
- Keep advanced panels in the same page to avoid hiding proof in another route.

## 16. Roadmap priority

1. Add guided step highlighting only if future presenter rehearsals need it.

## 17. Follow-ups

- Consider a true step-by-step overlay later; do not add more visible cards first.