# Change Correlation Spec

---
status: validated
owner: demo-team
created: 2026-09-16
updated: 2026-09-16
release_type: next demo enhancement
baseline_tag: operations-workbench-2026-09-16
---

## 1. Problem

The Workbench can explain impact and likely fault domains, but operators still
ask the natural next question: "What changed near the alert window?" Without a
bounded change view, the demo can feel like it stops before the most common
triage hypothesis: a recent deployment, route update, config change, or partner
change may have contributed to the alert.

## 2. Users and audience

- Primary user: integration support engineer or operations analyst.
- Secondary users: incident commander, application owner, enterprise architect.
- Demo audience: operations leaders, SRE/support teams, platform stakeholders.

## 3. Goals

- Add read-only correlation between active alerts and recent operational changes.
- Show the most relevant recent changes in the Workbench active case area.
- Ground correlation in MongoDB `source_records` fixture data.
- Keep the feature as evidence and hypothesis support, not automated root cause.

## 4. Product outcomes

- Operators can quickly answer "what changed?" during triage.
- Incident commanders can separate correlated evidence from confirmed cause.
- The demo strengthens MongoDB's role as a flexible operational context layer.
- The Workbench feels closer to a real keep-the-lights-on support workflow.

## 5. Demo success criteria

- A viewer can see recent changes for the selected alert after opening a case.
- The top correlated change shows time proximity, source system, change type,
  affected asset, and confidence.
- The UI clearly labels changes as correlated hypotheses, not proven cause.
- Full smoke validates that investigations return change correlation data.

## 6. Non-goals

- Do not integrate with real CI/CD, ServiceNow change, Git, or deployment tools.
- Do not implement causality scoring or automated rollback.
- Do not create remediation actions from change records.
- Do not add a separate change-management queue.

## 7. Requirements

- **REQ-001:** Enterprise fixture replay shall load recent change source records.
- **REQ-002:** Investigation results shall include a `change_correlation` object.
- **REQ-003:** Correlation shall consider alert interface, adjacent systems,
  impacted business process, and alert time proximity.
- **REQ-004:** Workbench UI shall show a compact "What changed?" card.
- **REQ-005:** MongoDB stage explanations shall include the change-correlation
  query pattern.
- **REQ-006:** Related evidence and follow-up Q&A shall mention recent changes
  when available.
- **REQ-007:** Correlated changes shall be read-only and demo-safe.

## 8. UX design

Place a compact "What changed?" panel near impact and related context. Show the
top three correlated changes with source, type, asset, age relative to alert,
confidence, and rationale. Empty state should say that recent changes appear
after investigation or enterprise fixture replay.

## 9. Data and API design

Use `source_records` with `record_type: "change"` from the enterprise fixture
pack. Change payloads include:

- `change_type`: deployment, config, route, partner
- `asset_type`: interface or system
- `asset_key`: canonical key
- `business_process_key`
- `summary`, `detail`, `risk`, `actor`

Investigation responses add:

- `change_correlation.query_window_minutes`
- `change_correlation.documents[]`
- `change_correlation.top_change`
- `change_correlation.summary`

## 10. MongoDB usage

- Flexible `source_records` store heterogeneous change events without schema
  migration.
- `find` queries filter changes by `record_type`, `observed_at`, `entity_key`,
  and payload keys.
- Correlation scoring happens in the service layer using returned MongoDB
  documents and topology context.
- Case memory persists the change correlation snapshot in `investigation_cases`.

## 11. Acceptance criteria

- [x] Enterprise fixture pack includes at least three change records.
- [x] Investigation results include `change_correlation.documents`.
- [x] Top correlated change has score, rationale, type, asset, and time context.
- [x] Workbench shows a "What changed?" card after investigation.
- [x] Stage explanations include a change-correlation MongoDB trace.
- [x] Full smoke validates change correlation and still resets cleanly.

## 12. Product risks

- Users may interpret correlation as causation unless copy is explicit.
- Too much change detail could distract from the primary Workbench narrative.
- Fixture-backed records must feel plausible and clearly sourced.

## 13. Validation plan

- API check: replay fixtures, investigate an Alertmanager alert, verify changes.
- Case check: create a case and verify persisted change correlation.
- Frontend check: `cd frontend && npm run build`.
- Smoke check: `npm run smoke`.
- Live rehearsal check: replay enterprise context and verify external alerts plus
  change records load cleanly.

## 14. Implementation tasks

- [x] Add fixture change records.
- [x] Add backend correlation service logic and MongoDB trace.
- [x] Add Workbench "What changed?" card and follow-up answer support.
- [x] Update docs/specs and full smoke coverage.
- [x] Validate and publish.

## 15. Decisions

- Keep changes as `source_records` rather than a new collection for this slice.
- Use deterministic scoring for demo repeatability.
- Frame the output as correlated context, not root-cause proof.

## 16. Roadmap priority

1. Implement lightweight change correlation.
2. Consider alert deduplication/noise reduction.
3. Consider an ITSM handoff spec only if needed.

## 17. Follow-ups

- Add a dedicated ITSM/change-management adapter spec if demo scope expands.
- Add deduplication once the alert feed grows beyond curated demo size.