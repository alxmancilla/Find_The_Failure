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
  the Workbench inbox while preserving repeated raw alert signals.
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
- **REQ-010:** Alerts shall expose a lightweight local lifecycle that supports
  demo-safe acknowledgement, investigation, escalation, resolution, and reopen.
- **REQ-011:** Investigation results shall show recent correlated changes as
  hypotheses grounded in source records.
- **REQ-012:** Alert listing shall collapse repeated signals into grouped inbox
  items while exposing raw/suppressed signal counts.

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

The selected alert panel includes local lifecycle controls. These controls update
Workbench state in MongoDB only; they do not page teams, create ITSM tickets, or
remediate systems.

The active case area includes a "What changed?" card that shows recent
deployment, config, and route changes near the alert window as correlated
hypotheses, not confirmed root cause.

The alert inbox and active case area include lightweight noise reduction. Repeated
signals are grouped into one Workbench alert card, with raw signal counts visible
and raw `source_records` preserved for audit.

## 9. Data and API design

- `POST /api/ingestion/fixtures` loads enterprise fixture `source_records`.
- `POST /api/ingestion/run` normalizes pending source records into relationships
  and events.
- `GET /api/alerts` returns grouped alert records plus raw and suppressed signal
  counts for the Workbench inbox.
- `POST /api/workbench/clear-demo-state` clears scripted demo alerts and cases.
- `POST /api/ingestion/fixtures/clear` clears enterprise fixture records and
  fixture-derived events/relationships.
- `POST /api/alerts/:sourceRecordKey/lifecycle` updates local Workbench lifecycle
  status on an alert source record.
- `POST /api/cases/investigate/:sourceRecordKey` creates persisted case memory.
  Investigation responses include `change_correlation` when matching change
  records are available.

## 10. MongoDB usage

- `source_records` stores raw enterprise evidence and alert payloads.
- `relationships` supports dependency traversal and business-process mapping.
- `$graphLookup` supports upstream/downstream topology expansion.
- Atlas Search / vector/rerank retrieval finds related operational knowledge.
- `investigation_cases` stores auditable case memory and follow-up messages.

## 11. Acceptance criteria

- [x] Enterprise replay adds two grouped Alertmanager inbox items while retaining
  repeated raw signals.
- [x] Secondary demo controls are collapsed by default.
- [x] Alert filters and case memory are collapsed by default.
- [x] The playbook shows four high-level phases instead of eight top-level steps.
- [x] Detailed checks still drive MongoDB stage explanations.
- [x] Reset clears optional replay/demo state while preserving the baseline.
- [x] The primary path is visually distinct from optional demo controls.
- [x] Case output includes owner, impact, evidence, and recommended next checks.
- [x] Active case output includes operational priority and an approval guardrail.
- [x] Alert output includes local lifecycle status and demo-safe transitions.
- [x] Active case output includes recent change correlation when fixture changes
  match the alert context.
- [x] Alert inbox groups repeated signals while preserving raw alert counts.
- [x] Active case output includes alert deduplication/noise-reduction context.

## 12. Product risks

- Alert lifecycle is intentionally lightweight and local-only; it is not an ITSM
  replacement or external escalation workflow.
- Change correlation can be mistaken for causation unless demo copy stays clear.
- Alert grouping can be mistaken for discarded evidence unless raw record
  preservation is emphasized.
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
  grouped Alertmanager inbox items with more raw alert signals than visible cards.

## 14. Implementation tasks

- [x] Add enterprise replay action to Workbench.
- [x] Rename scripted alert action as secondary rehearsal data.
- [x] Collapse demo controls, filters, and case memory.
- [x] Group the activity timeline into playbook phases.
- [x] Align Alert received copy with current source-record/case-memory behavior.
- [x] Add frontend-only Operational Priority card.
- [x] Add lightweight alert lifecycle status and controls.
- [x] Add fixture-backed recent change correlation.
- [x] Add lightweight alert deduplication/noise reduction.
- [x] Update README and demo runbook.

## 15. Decisions

- Keep the agent playbook stable across cases; vary the data and evidence.
- Keep the demo read-only from a remediation perspective.
- Preserve scripted demo alerts as optional rehearsal data, not the primary story.

## 16. Roadmap priority

1. Consider ITSM handoff only if demo scope expands.

## 17. Follow-ups

- Keep lifecycle read-only/demo-safe unless a future ITSM handoff spec is drafted.
- Keep change correlation framed as hypothesis support, not root-cause proof.
- Keep alert deduplication positioned as a transparent demo view, not a full
  production incident-correlation policy.