# Operator Approval Decision Log Spec

---
status: validated
owner: demo-team
created: 2026-09-30
updated: 2026-09-30
release_type: next demo enhancement
baseline_tag: operations-workbench-2026-09-16
---

## 1. Problem

The Workbench can prepare a read-only ITSM handoff preview, but it does not yet
show the human-in-the-loop decision that determines whether an operator would
approve, defer, or reject escalation. The demo needs a local decision log that
strengthens the safety story without creating external tickets or pages.

## 2. Users and audience

- Primary user: operations analyst reviewing an investigation.
- Secondary users: incident commander, service owner, support lead.
- Demo audience: operations leaders, SRE/support teams, platform stakeholders.

## 3. Goals

- Capture operator decisions against the handoff preview.
- Preserve decision history inside auditable case memory.
- Keep decisions local-only and demo-safe.
- Make approval status visible in the active case and case timeline.

## 4. Product outcomes

- Operators can demonstrate accountable approval before escalation.
- Leaders can see that agent output is reviewed rather than blindly executed.
- MongoDB stores the decision trail alongside investigation evidence.

## 5. Demo success criteria

- A case supports approve, defer, and reject decisions.
- The Workbench shows current approval state and recent decision history.
- Case timeline records each decision.
- Copy explicitly states no external action was sent.

## 6. Non-goals

- Do not call ServiceNow, Jira, Slack, PagerDuty, or email.
- Do not implement multi-user authorization or real approval routing.
- Do not execute remediation or escalation actions.
- Do not add new external dependencies.

## 7. Requirements

- **REQ-001:** The backend shall expose a local case approval-decision endpoint.
- **REQ-002:** Supported decisions shall be `approved`, `deferred`, and `rejected`.
- **REQ-003:** Decisions shall include actor, note, timestamp, and side-effect copy.
- **REQ-004:** Case memory shall persist the current approval state and history.
- **REQ-005:** Case timeline shall include approval-decision events.
- **REQ-006:** The Workbench shall show decision controls and history only after a
  case exists.
- **REQ-007:** The feature shall be read-only and shall not call external systems.

## 8. UX design

Add an "Approval decision" card near the handoff preview. Show current state,
approve/defer/reject controls, the most recent decisions, and a guardrail stating
that the action only records a local decision. Keep labels action-oriented but
safe: "Approve preview", "Defer", and "Reject".

## 9. Data and API design

Add:

- `POST /api/cases/:caseKey/approval-decision`

Request:

- `decision`: `approved | deferred | rejected`
- `actor`: optional, defaults to `demo-operator`
- `note`: optional human note

Persist on `investigation_cases`:

- `approval_state.status`
- `approval_state.updated_at`
- `approval_state.updated_by`
- `approval_state.note`
- `approval_state.external_side_effects`
- `approval_decisions[]`

## 10. MongoDB usage

- `investigation_cases.findOneAndUpdate()` appends each decision and updates the
  current approval state in a single case-memory write.
- Decision history remains local to the demo database and is returned through the
  existing case formatter.

## 11. Acceptance criteria

- [x] Backend records approved/deferred/rejected decisions on a case.
- [x] Case response includes current approval state and decision history.
- [x] Case timeline includes approval-decision events.
- [x] Workbench shows decision controls and local-only guardrail.
- [x] Full smoke validates approval decisions and cleanup.

## 12. Product risks

- Approval can be mistaken for external escalation unless copy is explicit.
- Demo-only actor defaults are not production authorization.
- Too many controls can distract from the main investigation flow.

## 13. Validation plan

- API check: create a case and post each decision type.
- Case check: verify approval state, history, and timeline events.
- Frontend check: `cd frontend && npm run build`.
- Smoke check: `npm run smoke`.

## 14. Implementation tasks

- [x] Add backend approval-decision service and route.
- [x] Add API helper and Workbench approval card.
- [x] Update docs/specs and full smoke coverage.
- [x] Validate and publish.

## 15. Decisions

- Store decisions directly on `investigation_cases` for the demo slice.
- Keep actor/note lightweight and deterministic.
- Treat approval as a recorded decision, not as permission to call an external
  system.