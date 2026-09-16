# Operations Workbench Spec

---
status: validated
owner: demo-team
created: 2026-09-16
updated: 2026-09-16
release_type: operations demo baseline
baseline_tag: operations-workbench-2026-09-16
---

## 1. Problem

Operations and integration support teams need to move from an alert to trusted
business impact, ownership, evidence, and safe next checks without searching
across disconnected topology diagrams, CMDB records, runbooks, and prior tickets.

## 2. Users and audience

- Primary user: integration support engineer or operations analyst.
- Secondary users: enterprise architect, application owner, incident commander.
- Demo audience: operations, architecture, platform, and MongoDB stakeholders.

## 3. Goals

- Start with an operational alert, not a static architecture view.
- Replay realistic enterprise context from Alertmanager, catalog, and CMDB-style
  records into the Workbench inbox.
- Use a consistent investigation playbook across cases while keeping evidence
  and impact case-specific.
- Prove MongoDB usage through visible stage traces and auditable case memory.

## 4. Product outcomes

- Reduce time spent finding blast radius, owner, evidence, and next checks.
- Help support teams avoid paging the wrong owner during integration incidents.
- Make source provenance visible enough for operators to trust the context.
- Preserve investigation context for shift handoff, follow-up, and review.
- Demonstrate MongoDB as the operational context layer above existing tools.

## 5. Demo success criteria

- A first-time viewer can identify the primary next action in the Workbench.
- Enterprise replay visibly turns external context into Workbench alerts.
- A selected alert produces business process impact, owner, likely fault domain,
  operational priority, evidence, related context, and recommended next checks in
  one flow.
- MongoDB trace is available on demand but does not dominate the default UI.
- The presenter can complete the hero path in about six minutes.
- Reset reliably returns the demo to a clean rehearsal state.

## 6. Non-goals

- Do not perform autonomous remediation.
- Do not replace ITSM, observability, or integration platforms.
- Do not model every enterprise incident-management lifecycle state.
- Do not require live external systems for the demo path.

## 7. Requirements

- **REQ-001:** The Workbench shall provide a primary `Replay enterprise context`
  action that loads fixture records and refreshes the alert inbox.
- **REQ-002:** Enterprise replay shall surface two Alertmanager-style alerts in
  the Workbench inbox.
- **REQ-003:** Optional scripted alerts and reset actions shall be available under
  collapsed `Demo controls`.
- **REQ-004:** Reset shall clear enterprise fixtures, scripted demo alerts, and
  case memory while preserving the seeded baseline.
- **REQ-005:** The Workbench shall guide the user through replay context, select
  alert, open case, and review evidence.
- **REQ-006:** The investigation playbook shall group detailed checks into
  Intake, Impact, Evidence, and Recommendation phases.
- **REQ-007:** Detailed playbook checks shall remain clickable and show MongoDB
  usage for the selected stage.
- **REQ-008:** Each investigation case shall persist summary, evidence, likely
  fault domain, recommended checks, timeline, and follow-up messages.
- **REQ-009:** The active case area shall show operational priority derived from
  existing alert, impact, owner, and recommendation data.

## 8. UX design

The default sidebar emphasizes one path: replay enterprise context, select an
alert, open an investigation case, and review evidence. Secondary controls,
filters, and case memory are collapsed to reduce cognitive load.

The main panel presents a grouped Investigation playbook. The four phases remain
stable for every case, while the underlying checks, evidence, related context,
topology, and recommendations are populated from the selected alert.

The active case area also presents Operational Priority so operators can quickly
see urgency, SLA/risk, business process, likely owner, likely fault domain, first
safe check, and the human-approval guardrail.

## 9. Data and API design

- `POST /api/ingestion/fixtures` loads enterprise fixture `source_records`.
- `POST /api/ingestion/run` normalizes pending source records into relationships
  and events.
- `GET /api/alerts` returns all alert records formatted for the Workbench inbox.
- `POST /api/workbench/clear-demo-state` clears scripted demo alerts and cases.
- `POST /api/ingestion/fixtures/clear` clears enterprise fixture records and
  fixture-derived events/relationships.
- `POST /api/cases/investigate/:sourceRecordKey` creates persisted case memory.

## 10. MongoDB usage

- `source_records` stores raw enterprise evidence and alert payloads.
- `relationships` supports dependency traversal and business-process mapping.
- `$graphLookup` supports upstream/downstream topology expansion.
- Atlas Search / vector/rerank retrieval finds related operational knowledge.
- `investigation_cases` stores auditable case memory and follow-up messages.

## 11. Acceptance criteria

- [x] Enterprise replay adds two external Alertmanager alerts to the inbox.
- [x] Secondary demo controls are collapsed by default.
- [x] Alert filters and case memory are collapsed by default.
- [x] The playbook shows four high-level phases instead of eight top-level steps.
- [x] Detailed checks still drive MongoDB stage explanations.
- [x] Reset clears optional replay/demo state while preserving the baseline.
- [x] The primary path is visually distinct from optional demo controls.
- [x] Case output includes owner, impact, evidence, and recommended next checks.
- [x] Active case output includes operational priority and an approval guardrail.

## 12. Product risks

- The Workbench is not yet a full operational queue because alert lifecycle
  states are intentionally out of scope.
- Fixture replay may be perceived as synthetic unless positioned as a safe
  enterprise ingestion rehearsal.
- SLA/priority indicators are derived from demo data and should be positioned as
  operational guidance, not a production incident policy engine.
- Lack of change correlation may leave operators asking, "What changed?"
- MongoDB traces can distract business users if opened too early in the demo.

## 13. Validation plan

- Frontend build: `cd frontend && npm run build`.
- Full smoke: `npm run smoke`.
- Live health check: `GET /api/health`.
- Live inbox check: load enterprise fixtures, run ingestion, then verify two
  alerts with `source_system: alertmanager-webhook`.

## 14. Implementation tasks

- [x] Add enterprise replay action to Workbench.
- [x] Rename scripted alert action as secondary rehearsal data.
- [x] Collapse demo controls, filters, and case memory.
- [x] Group the activity timeline into playbook phases.
- [x] Align Alert received copy with current source-record/case-memory behavior.
- [x] Add frontend-only Operational Priority card.
- [x] Update README and demo runbook.

## 15. Decisions

- Keep the agent playbook stable across cases; vary the data and evidence.
- Keep the demo read-only from a remediation perspective.
- Preserve scripted demo alerts as optional rehearsal data, not the primary story.

## 16. Roadmap priority

1. **Alert lifecycle** — adds queue realism with acknowledge, investigate,
   escalate, and resolve states.
2. **Change correlation** — connects symptoms to recent deployments, config
   changes, routing updates, and ownership changes.
3. **Alert deduplication and noise reduction** — important for scale realism,
   but less urgent for the curated demo size.

## 17. Follow-ups

- Add a future spec for alert lifecycle.
- Add a future spec for change correlation and recent deployment context.
- Add a future spec for alert deduplication and noise reduction.