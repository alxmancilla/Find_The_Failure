# Similar Case Retrieval Spec

---
status: validated
owner: demo-team
created: 2026-09-30
updated: 2026-09-30
release_type: agent memory enhancement
baseline_tag: operations-workbench-2026-09-16
---

## 1. Problem

The Workbench persists investigation cases, but new investigations do not yet use
that memory to surface prior similar cases. Operators should see when a current
alert resembles a previous case without leaving the supervised flow.

## 2. Users and audience

- Primary user: operations analyst or integration support engineer.
- Secondary users: incident commander, platform owner, enterprise architect.
- Demo audience: MongoDB stakeholders evaluating agent memory patterns.

## 3. Goals

- Retrieve prior cases from `investigation_cases` during alert investigation.
- Match cases using top-level projected fields, not the full result blob.
- Explain why each prior case matched the current alert.
- Keep the feature read-only and demo-safe.

## 4. Product outcomes

- Operators can reuse prior investigation context faster.
- Architects see how MongoDB case memory supports agentic workflows.
- The demo shows a progression from single-case memory to reusable memory.

## 5. Demo success criteria

- A repeated investigation shows at least one prior similar case.
- The Workbench displays match reasons and similarity scores.
- MongoDB trace shows the `investigation_cases.find()` query pattern.
- Full smoke validates the behavior and cleans up case memory.

## 6. Non-goals

- Do not auto-resolve incidents from prior cases.
- Do not perform vector search over case blobs in this slice.
- Do not add cross-tenant search or authentication.

## 7. Requirements

- **REQ-001:** Investigation responses shall include `similar_cases`.
- **REQ-002:** Similar cases shall be retrieved from `investigation_cases` using
  tenant, environment, interface, process, dedupe group, fault domain, related
  context, and change-key projections.
- **REQ-003:** Each returned case shall include match reasons and a deterministic
  similarity score.
- **REQ-004:** The Workbench shall display similar cases after investigation.
- **REQ-005:** MongoDB trace shall include the similar-case query.

## 8. UX design

Add a compact right-panel card titled "Similar case memory". Empty state explains
that the first case creates memory and repeated/similar cases can be matched later.

## 9. Data and API design

No new endpoint is required. `GET /api/investigation/:sourceRecordKey` and
`POST /api/cases/investigate/:sourceRecordKey` include `similar_cases` in the
investigation payload.

## 10. MongoDB usage

- Query `investigation_cases` with compound indexes and projected fields.
- Keep the full case snapshot for audit, but match against top-level fields.
- Return a safe trace showing the `find().sort().limit()` pattern.

## 11. Acceptance criteria

- [x] Similar cases are returned after at least one prior matching case exists.
- [x] Similar cases include match reasons and similarity scores.
- [x] Workbench displays the similar-case memory panel.
- [x] Full smoke asserts similar-case retrieval and trace presence.

## 12. Product risks

- Similarity can be mistaken for confirmed root cause; copy must frame it as prior
  context, not automation.
- First-run empty state must feel intentional, not broken.

## 13. Validation plan

- Backend import check.
- Frontend build.
- Full smoke: create a case, rerun investigation, assert similar case appears.
- Targeted live API check for match reasons and trace.

## 14. Implementation tasks

- [x] Backend retrieval and trace.
- [x] Workbench panel and playbook stage.
- [x] Docs/spec/smoke updates.
- [x] Validation and publish.

## 15. Decisions

- Use deterministic field matching first; defer vector similarity over case text.
- Include previous runs for the same alert as valid similar cases.

## 16. Roadmap priority

1. Add grounded backend follow-up Q&A over active case and similar cases.
2. Add vectorized case summaries for semantic case retrieval.

## 17. Follow-ups

- Tune match weights with real historical cases in a non-demo environment.