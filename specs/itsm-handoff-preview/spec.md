# ITSM Handoff / Escalation Preview Spec

---
status: validated
owner: demo-team
created: 2026-09-30
updated: 2026-09-30
release_type: next demo enhancement
baseline_tag: operations-workbench-2026-09-16
---

## 1. Problem

The Workbench can investigate alerts, correlate context, retrieve prior cases, and
recommend safe checks. The next operator question is often, "What would I hand to
ServiceNow, Jira, or an escalation channel?" The demo needs a clear handoff
package without implying autonomous ticket creation or paging.

## 2. Users and audience

- Primary user: operations analyst or integration support engineer.
- Secondary users: incident commander, service owner, support lead.
- Demo audience: operations leaders, SRE/support teams, platform stakeholders.

## 3. Goals

- Prepare a human-reviewable ITSM/escalation handoff preview.
- Ground the preview in the current investigation result and case memory.
- Show assignment, urgency, summary, impact, evidence, and approval guardrails.
- Keep the feature read-only and demo-safe with no external side effects.

## 4. Product outcomes

- Operators can quickly see what information is ready for escalation.
- Incident commanders can verify handoff quality before approving action.
- The demo connects investigation context to enterprise operating processes.
- MongoDB remains the auditable source for the handoff package.

## 5. Demo success criteria

- Investigation results include a handoff preview object.
- The active case area shows a compact "Handoff preview" card.
- The preview clearly states that no ticket, page, or remediation was sent.
- Case timeline and MongoDB traces show the handoff-preparation step.

## 6. Non-goals

- Do not integrate with real ServiceNow, Jira, Slack, PagerDuty, or email.
- Do not create tickets, pages, approvals, or remediation actions.
- Do not model every ITSM field or workflow state.
- Do not add credentials or external dependency packages.

## 7. Requirements

- **REQ-001:** Investigation results shall include `handoff_preview`.
- **REQ-002:** Handoff preview shall include target queue, urgency, summary,
  assignment group, business impact, evidence summary, and recommended checks.
- **REQ-003:** Handoff preview shall include explicit approval-required copy.
- **REQ-004:** Case timeline shall include a handoff-prepared event.
- **REQ-005:** MongoDB stage explanations shall include the case-memory handoff
  query/write pattern.
- **REQ-006:** Follow-up Q&A shall answer handoff/escalation questions from saved
  case memory.
- **REQ-007:** The feature shall be read-only and shall not call external systems.

## 8. UX design

Add a compact "Handoff preview" card near priority, impact, and evidence. Show the
target queue, urgency, assignment group, draft title, business impact, included
context chips, and a clear approval guardrail. Keep any action label as "Preview"
or "Ready for review", never "Create ticket".

## 9. Data and API design

Investigation responses add:

- `handoff_preview.target_system`
- `handoff_preview.target_queue`
- `handoff_preview.urgency`
- `handoff_preview.assignment_group`
- `handoff_preview.draft_title`
- `handoff_preview.business_impact`
- `handoff_preview.evidence_summary[]`
- `handoff_preview.recommended_checks[]`
- `handoff_preview.approval_required`

The persisted `investigation_cases.investigation_result` stores the preview as a
snapshot. No new endpoint is needed for this lightweight slice.

## 10. MongoDB usage

- `source_records`, `relationships`, owners, related context, changes, and similar
  cases feed the generated handoff preview.
- `investigation_cases` stores the handoff preview snapshot as part of case memory.
- Follow-up Q&A reads persisted case memory to explain handoff content later.

## 11. Acceptance criteria

- [x] Investigation result includes `handoff_preview`.
- [x] Handoff preview includes target, urgency, assignment, impact, evidence, and
  approval-required fields.
- [x] Workbench shows a "Handoff preview" card after investigation.
- [x] Case timeline includes a handoff-prepared event.
- [x] MongoDB stage panel includes handoff trace details.
- [x] Full smoke validates handoff preview and resets cleanly.

## 12. Product risks

- Users may assume a real ticket was created unless copy is explicit.
- Too many fields could distract from the investigation narrative.
- Assignment and urgency are deterministic demo guidance, not production policy.

## 13. Validation plan

- API check: investigate an alert and verify `handoff_preview` fields.
- Case check: create a case and verify timeline and persisted handoff snapshot.
- Frontend check: `cd frontend && npm run build`.
- Smoke check: `npm run smoke`.
- Live rehearsal check: replay enterprise context and verify handoff preview.

## 14. Implementation tasks

- [x] Add backend handoff preview generation and trace.
- [x] Add Workbench handoff panel and playbook step.
- [x] Add backend-grounded follow-up answer support for handoff questions.
- [x] Update docs/specs and full smoke coverage.
- [x] Validate and publish.

## 15. Decisions

- Keep handoff preview in the investigation result rather than a new ITSM object.
- Use deterministic assignment/urgency derived from existing investigation data.
- Keep all external-action language explicitly read-only.

## 16. Roadmap priority

1. Implement read-only handoff preview.
2. Consider a real ITSM adapter only if a future spec requires credentials,
   approval flow, and safety review.

## 17. Follow-ups

- Draft a separate production ITSM integration spec before adding external writes.
- Consider a human approval queue only after demo-safe preview is validated.