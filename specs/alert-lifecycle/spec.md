# Alert Lifecycle Spec

---
status: validated
owner: demo-team
created: 2026-09-16
updated: 2026-09-16
release_type: next demo enhancement
baseline_tag: operations-workbench-2026-09-16
---

## 1. Problem

The Workbench investigates alerts but does not yet show how an operations user
tracks alert handling progress. Support teams need a lightweight way to show
that an alert has been acknowledged, is under investigation, has been escalated,
or is resolved without implying real ITSM replacement or autonomous remediation.

## 2. Users and audience

- Primary user: operations analyst or integration support engineer.
- Secondary users: incident commander, application owner, enterprise architect.
- Demo audience: operations leaders, support teams, platform stakeholders.

## 3. Goals

- Add a small persisted lifecycle to Workbench alerts.
- Make the current handling state visible in the inbox and selected alert panel.
- Automatically mark an alert as `investigating` when an investigation case is
  opened.
- Keep lifecycle transitions demo-safe and local to MongoDB context records.

## 4. Product outcomes

- Operators can see whether a selected alert has been acknowledged or acted on.
- The demo feels more like an operations queue without becoming a full ITSM tool.
- Case creation feels connected to operational workflow state.
- The read-only remediation guardrail remains clear.

## 5. Demo success criteria

- A viewer can identify lifecycle status from the alert card or selected alert.
- A presenter can acknowledge, escalate, or resolve an alert without leaving the
  Workbench.
- Opening a case moves the alert into `investigating`.
- Reset returns lifecycle state to the clean baseline.

## 6. Non-goals

- Do not integrate with PagerDuty, ServiceNow, Jira, Slack, or email.
- Do not implement assignment, comments, SLAs, or full incident state machines.
- Do not perform real escalation or remediation actions.
- Do not introduce authentication or RBAC in this slice.

## 7. Requirements

- **REQ-001:** Alerts shall expose a lifecycle status with default `new`.
- **REQ-002:** The Workbench shall show lifecycle status on alert cards and the
  selected alert panel.
- **REQ-003:** The selected alert panel shall provide demo-safe transitions for
  acknowledge, escalate, resolve, and reopen.
- **REQ-004:** Opening an investigation case shall mark the alert as
  `investigating`.
- **REQ-005:** Lifecycle transitions shall persist on the alert `source_records`
  document with timestamped history.
- **REQ-006:** Reset shall remove optional lifecycle metadata from remaining
  alerts while preserving seeded baseline records.
- **REQ-007:** Lifecycle UI shall not add new top-level sidebar controls.

## 8. UX design

Keep lifecycle compact. Alert cards show a small lifecycle tag. The selected
alert panel shows the current state and a compact row of transition buttons.
Lifecycle copy must state that transitions are demo-safe status updates only.

## 9. Data and API design

Persist lifecycle metadata on `source_records.workbench_lifecycle`:

- `status`: `new`, `acknowledged`, `investigating`, `escalated`, `resolved`
- `updated_at`: transition timestamp
- `updated_by`: demo actor
- `history`: timestamped transition history

API additions:

- `POST /api/alerts/:sourceRecordKey/lifecycle`
  - body: `{ "status": "acknowledged" }`
  - returns the updated formatted alert

## 10. MongoDB usage

- `source_records` remains the durable alert intake collection.
- Lifecycle updates use `$set` and `$push` against the selected alert record.
- Case creation writes `investigation_cases` and also updates alert lifecycle to
  `investigating`.

## 11. Acceptance criteria

- [x] Alerts default to lifecycle `new` when no persisted lifecycle exists.
- [x] Lifecycle status appears on alert cards and selected alert details.
- [x] Acknowledge, escalate, resolve, and reopen transitions persist through the
  lifecycle API.
- [x] Opening an investigation case moves the alert to `investigating`.
- [x] Reset clears lifecycle metadata for remaining alerts.
- [x] No real external escalation/remediation is triggered.
- [x] Frontend build, API checks, and full smoke pass.

## 12. Product risks

- Lifecycle controls may make the Workbench look like an ITSM replacement unless
  the demo-safe/local-only scope is clear.
- Too many status buttons could reintroduce sidebar complexity.
- Reset semantics must be clear because lifecycle writes persist to MongoDB.

## 13. Validation plan

- Backend API check: update an alert lifecycle and verify returned status.
- Case check: open an investigation and verify lifecycle becomes `investigating`.
- Reset check: reset demo state and verify remaining alerts default to `new`.
- Frontend build: `cd frontend && npm run build`.
- Full smoke: `npm run smoke`.

## 14. Implementation tasks

- [x] Add lifecycle API service and route.
- [x] Include lifecycle in formatted alerts.
- [x] Auto-transition to `investigating` on case creation.
- [x] Add compact lifecycle controls to selected alert UI.
- [x] Add lifecycle tags to alert cards.
- [x] Update smoke/docs/specs and validate.

## 15. Decisions

- Store lifecycle as optional metadata on `source_records` to avoid new
  collections for this demo slice.
- Treat lifecycle transitions as local Workbench state only.

## 16. Roadmap priority

1. Implement lightweight persisted lifecycle.
2. Add change correlation.
3. Revisit lifecycle depth only if the demo needs assignment or ITSM handoff.

## 17. Follow-ups

- Consider linking lifecycle transitions to case timeline events.
- Consider a future ITSM handoff spec if needed.