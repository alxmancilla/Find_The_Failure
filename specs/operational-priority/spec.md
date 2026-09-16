# Operational Priority Spec

---
status: draft
owner: demo-team
created: 2026-09-16
updated: 2026-09-16
release_type: next demo enhancement
baseline_tag: operations-workbench-2026-09-16
---

## 1. Problem

Operations users need to understand not only what failed, but how urgently to
act. The current Workbench shows severity, impact, ownership, and next checks,
but does not package them into an operational priority summary that answers:
"How bad is this, who should act, and what is the safe escalation path?"

## 2. Users and audience

- Primary user: integration support engineer or operations analyst.
- Secondary users: incident commander, application owner, enterprise architect.
- Demo audience: operations leaders, SRE/support teams, platform stakeholders.

## 3. Goals

- Add a compact operational priority summary to the active case experience.
- Make severity, business process, SLA risk, owner, and recommended escalation
  easy to see without opening secondary panels.
- Reinforce that the Workbench recommends safe checks and human-approved
  escalation, not autonomous remediation.

## 4. Product outcomes

- Operators can identify urgency and owner faster.
- Incident commanders can communicate business risk more clearly.
- The demo better matches a keep-the-lights-on support workflow.
- MongoDB's role as context layer is clearer because priority is derived from
  alert, topology, process, owner, and evidence data.

## 5. Demo success criteria

- A viewer can answer "how urgent is this?" within a few seconds of opening a
  case.
- The summary shows the impacted process and likely owner without extra clicks.
- The recommendation explicitly distinguishes read-only checks from remediation.
- The feature improves the hero path without adding another noisy control.

## 6. Non-goals

- Do not implement a full incident lifecycle.
- Do not page real teams or call external notification systems.
- Do not add autonomous remediation actions.
- Do not require new third-party dependencies.

## 7. Requirements

- **REQ-001:** The active investigation shall show an Operational Priority card.
- **REQ-002:** The card shall display severity, alert status, impacted business
  process, likely owner, and top fault domain when available.
- **REQ-003:** The card shall derive an SLA/risk label from existing demo data
  without requiring backend schema changes for the first slice.
- **REQ-004:** The card shall display one recommended escalation or first check.
- **REQ-005:** The card shall include a guardrail message that remediation
  requires operator approval.
- **REQ-006:** Empty state copy shall explain that priority appears after an
  alert is selected or investigated.

## 8. UX design

Place the Operational Priority card near the top of the active case area, close
to the existing business impact summary. Keep it compact and scannable with
short labels: Severity, SLA/risk, Process, Owner, Fault domain, First check.

Use calm operational language. Avoid alarmist copy. The card should clarify
urgency without implying automated remediation.

## 9. Data and API design

First slice should use existing Workbench data only:

- selected alert severity/status/source system
- impacted business processes from investigation result
- owners from investigation result
- likely fault domains from investigation result
- recommended next actions from investigation result

No backend API change is required unless later iterations need richer SLA
metadata, elapsed timers, or persisted incident status.

## 10. MongoDB usage

The card should be explainable as a derived view over existing MongoDB-backed
context:

- `source_records` for alert severity/status/source.
- `relationships` and `$graphLookup` for topology and process context.
- `owners` for escalation target.
- `investigation_cases` for persisted recommendations and audit trail.

## 11. Acceptance criteria

- [ ] Operational Priority card appears in the active case experience.
- [ ] Before investigation, it shows selected-alert severity/status and a clear
  prompt to open a case for owner/process/priority detail.
- [ ] After investigation, it shows SLA/risk, process, owner, top fault domain,
  and first check.
- [ ] The card includes a read-only/human-approval guardrail.
- [ ] It does not add new top-level sidebar controls.
- [ ] Existing full smoke and frontend build still pass.

## 12. Product risks

- A synthetic SLA label could feel arbitrary if not clearly framed as demo logic.
- Too much priority detail could compete with the existing business impact card.
- Without real incident lifecycle states, users may ask how priority changes over
  time.

## 13. Validation plan

- Frontend build: `cd frontend && npm run build`.
- Full smoke: `npm run smoke`.
- Manual rehearsal: replay enterprise context, select each external alert, open
  an investigation, and confirm the priority card updates.

## 14. Implementation tasks

- [ ] Design compact card placement and copy.
- [ ] Implement derived priority helper in the Workbench component.
- [ ] Add card styling.
- [ ] Update demo runbook and Operations Workbench spec if behavior changes.
- [ ] Run validation plan and update this spec status.

## 15. Decisions

- First slice should be frontend-only if existing investigation data is enough.
- Human approval guardrail is required even though remediation is out of scope.

## 16. Roadmap priority

1. Implement frontend-only derived priority summary.
2. Add persisted alert lifecycle in a separate spec.
3. Add richer SLA metadata if needed for later demos.

## 17. Follow-ups

- Consider an alert lifecycle spec for acknowledge, investigate, escalate, and
  resolve states.
- Consider a change-correlation spec to answer "what changed?"