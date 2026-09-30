# Grounded Follow-up Q&A Spec

---
status: validated
owner: demo-team
created: 2026-09-30
updated: 2026-09-30
release_type: agent memory enhancement
baseline_tag: operations-workbench-2026-09-16
---

## 1. Problem

The Workbench can persist follow-up messages, but the browser currently generates
answers locally before saving them. Follow-up answers should be produced by the
backend from persisted case memory so they are auditable, repeatable, and grounded
in MongoDB context.

## 2. Users and audience

- Primary user: operations analyst or integration support engineer.
- Secondary users: incident commander, platform owner, enterprise architect.
- Demo audience: MongoDB stakeholders evaluating agent memory and governance.

## 3. Goals

- Generate follow-up answers on the backend from active case memory.
- Ground answers in the persisted investigation snapshot, evidence, related
  context, recent changes, and similar cases.
- Persist both question and answer as auditable case messages.
- Return a safe MongoDB trace for the answer path.

## 4. Product outcomes

- Operators receive consistent answers across browser sessions.
- Architects see MongoDB as the auditable state layer for agent conversations.
- The demo moves from local helper text toward production-shaped agent memory.

## 5. Demo success criteria

- Asking a follow-up calls the backend, not local answer generation.
- The saved case contains both the user question and grounded agent answer.
- The agent answer includes grounding labels and a MongoDB trace.
- Full smoke validates the endpoint and cleanup behavior.

## 6. Non-goals

- Do not call an external LLM in this slice.
- Do not execute remediation or external escalation.
- Do not answer outside the active case context.

## 7. Requirements

- **REQ-001:** `POST /api/cases/:caseKey/messages` shall require `question` only.
- **REQ-002:** The backend shall generate the answer from persisted case memory.
- **REQ-003:** Answers shall include `grounded_in`, citations, and MongoDB trace.
- **REQ-004:** The Workbench shall render backend-saved messages.
- **REQ-005:** Full smoke shall assert backend-grounded Q&A persistence.

## 8. UX design

The existing follow-up panel remains compact. Copy changes from local answers to
backend-grounded case memory. While the answer is pending, controls are disabled.

## 9. Data and API design

Reuse `POST /api/cases/:caseKey/messages` with body `{ "question": "..." }`.
Response returns `{ case, answer }`; `case.messages` contains the persisted user
and agent messages.

## 10. MongoDB usage

- `investigation_cases.findOne({ key })` loads the persisted case snapshot.
- `investigation_cases.findOneAndUpdate()` appends messages and timeline.
- Message metadata records grounding labels, citations, and answer trace.

## 11. Acceptance criteria

- [x] Backend endpoint answers without a client-supplied answer.
- [x] Saved case messages include grounded agent metadata.
- [x] Workbench no longer generates answers locally.
- [x] Full smoke asserts answer persistence and trace presence.

## 12. Product risks

- Deterministic answers may appear less flexible than LLM answers; frame this as a
  safe Agent v1 grounding pattern.
- Grounded answers must avoid implying recent changes or similar cases are proven
  root cause.

## 13. Validation plan

- Backend import check.
- Frontend build.
- Full smoke: create case, ask follow-up, assert answer and trace.
- Targeted live API check for grounding metadata.

## 14. Implementation tasks

- [x] Backend grounded answer service and route.
- [x] Workbench API wiring.
- [x] Docs/spec/smoke updates.
- [x] Validation and publish.

## 15. Decisions

- Keep deterministic answer routing for this slice.
- Preserve a future path to replace answer generation with an LLM while keeping the
  same MongoDB case-memory contract.

## 16. Roadmap priority

1. Add optional LLM answer synthesis with citations and approval guardrails.
2. Add answer evaluation fixtures for hallucination/regression testing.

## 17. Follow-ups

- Consider separate answer quality scoring once real incident data exists.