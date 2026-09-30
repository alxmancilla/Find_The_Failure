# Case Closure Outcomes Spec

---
status: validated
owner: demo-team
created: 2026-09-30
updated: 2026-09-30
release_type: next demo enhancement
baseline_tag: operations-workbench-2026-09-16
---

## 1. Problem

The Workbench can investigate alerts, prepare a handoff preview, and record local
approval decisions. It still lacks a safe way to show how an operator closes the
loop after review. The demo needs local case outcomes that document whether the
case is resolved, being monitored, or transferred without modifying external
systems.

## 2. Users and audience

- Primary user: operations analyst completing an investigation.
- Secondary users: incident commander, service owner, support lead.
- Demo audience: operations leaders, SRE/support teams, platform stakeholders.

## 3. Goals

- Capture a final or interim case outcome in MongoDB case memory.
- Preserve outcome history and timeline events.
- Keep the feature local-only and demo-safe.
- Make case status visible in the active case and case memory list.

## 4. Product outcomes

- Operators can show end-to-end workflow closure, not just triage.
- Leaders can see approval and outcome history attached to evidence.
- MongoDB remains the auditable memory layer for case state.

## 5. Demo success criteria

- A case supports resolved, monitoring, and transferred outcomes.
- The Workbench shows current case outcome and recent history.
- Case timeline records each outcome update.
- Copy states that no external ticket, page, or remediation was changed.

## 6. Non-goals

- Do not close ServiceNow/Jira tickets or update external incident systems.
- Do not page, email, or remediate systems.
- Do not implement production authorization or multi-user workflow.
- Do not add external dependencies.

## 7. Requirements

- **REQ-001:** The backend shall expose a local case outcome endpoint.
- **REQ-002:** Supported outcomes shall be `resolved`, `monitoring`, and
  `transferred`.
- **REQ-003:** Outcomes shall include actor, note, timestamp, and side-effect copy.
- **REQ-004:** Case memory shall persist current outcome and outcome history.
- **REQ-005:** Case status shall reflect the selected outcome for list filtering and
  display.
- **REQ-006:** Case timeline shall include outcome events.
- **REQ-007:** The Workbench shall show outcome controls only after a case exists.
- **REQ-008:** The feature shall not call external systems.

## 8. UX design

Add a compact "Case outcome" card near approval and handoff. Show the current
status, action buttons for "Resolved", "Monitor", and "Transfer", the latest
outcome history, and a local-only guardrail. Keep it visually secondary to the
investigation result.

## 9. Data and API design

Add:

- `POST /api/cases/:caseKey/outcome`

Request:

- `outcome`: `resolved | monitoring | transferred`
- `actor`: optional, defaults to `demo-operator`
- `note`: optional human note

Persist on `investigation_cases`:

- `status`: outcome status for existing case list display
- `case_outcome.status`
- `case_outcome.updated_at`
- `case_outcome.updated_by`
- `case_outcome.note`
- `case_outcome.external_side_effects`
- `case_outcomes[]`

## 10. MongoDB usage

- `investigation_cases.findOneAndUpdate()` updates case status/outcome and appends
  the outcome history plus timeline entry in one local case-memory write.

## 11. Acceptance criteria

- [x] Backend records resolved/monitoring/transferred outcomes on a case.
- [x] Case response includes current outcome and outcome history.
- [x] Case status reflects the most recent outcome.
- [x] Case timeline includes outcome events.
- [x] Workbench shows outcome controls and local-only guardrail.
- [x] Full smoke validates outcomes and cleanup.

## 12. Product risks

- Case closure can be mistaken for closing an external ticket unless copy is clear.
- Demo-only actor defaults are not production authorization.
- Too many workflow controls can distract from the investigation narrative.

## 13. Validation plan

- API check: create a case and post all supported outcomes.
- Case check: verify status, outcome history, and timeline events.
- Frontend check: `cd frontend && npm run build`.
- Smoke check: `npm run smoke`.

## 14. Implementation tasks

- [x] Add backend case outcome service and route.
- [x] Add API helper and Workbench outcome card.
- [x] Update docs/specs and full smoke coverage.
- [x] Validate and publish.

## 15. Decisions

- Store outcomes directly on `investigation_cases` for this demo slice.
- Use status values that read naturally in case memory.
- Treat outcome recording as local case memory, not as an external close action.