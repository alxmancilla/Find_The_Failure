# MongoDB Agent Hardening Spec

---
status: validated
owner: demo-team
created: 2026-09-30
updated: 2026-09-30
release_type: production-shaped hardening
baseline_tag: operations-workbench-2026-09-16
---

## 1. Problem

The Workbench agent demonstrates a strong read-only investigation flow, but its
MongoDB model can better reflect production patterns. Tenant/environment scope,
query-aligned indexes, queryable case fields, and score breakdowns make the demo
more credible for enterprise review without changing the user journey.

## 2. Users and audience

- Primary user: operations analyst or integration support engineer.
- Secondary users: platform owner, data architect, enterprise architect.
- Demo audience: MongoDB stakeholders evaluating production readiness.

## 3. Goals

- Add tenant and environment scope to operational agent records.
- Add indexes aligned to Workbench query patterns.
- Persist top-level case fields for case memory lookup and future analytics.
- Expose score components behind fault-domain confidence.

## 4. Product outcomes

- Architects see a clearer path from demo to multi-tenant production design.
- Operators retain the same Workbench flow with more auditable case memory.
- MongoDB query patterns are easier to explain, tune, and validate.

## 5. Demo success criteria

- Existing smoke flow still passes unchanged from the user's perspective.
- Investigation cases store tenant, environment, interface, process, dedupe,
  related-context, change, and confidence fields at top level.
- Fault-domain candidates expose score components, not only final scores.
- Source records and events include tenant/environment metadata.

## 6. Non-goals

- Do not add authentication or row-level authorization in this slice.
- Do not change the fictional single-tenant demo company.
- Do not add autonomous remediation or external integrations.
- Do not replace the current deterministic Agent v1 flow.

## 7. Requirements

- **REQ-001:** Source records, events, relationships, operational knowledge, and
  investigation cases shall support `tenant_id` and `environment` fields.
- **REQ-002:** Workbench alert, dedupe, change-correlation, event, retrieval, and
  case-memory query paths shall have supporting MongoDB indexes.
- **REQ-003:** New investigation cases shall project key lookup fields to the top
  level while preserving the full investigation snapshot.
- **REQ-004:** Ranked fault domains shall include `score_components` explaining
  positive and negative factors.
- **REQ-005:** Smoke validation shall assert the new fields exist.

## 8. UX design

No new UI controls are required. The existing confidence rationale remains visible;
score components are available in the API/case memory for auditability.

## 9. Data and API design

Add optional fields to operational schemas: `tenant_id`, `environment`, and case
lookup projections such as `interface_key`, `business_process_key`,
`dedupe_group_key`, `confidence_score`, `related_context_keys`, and `change_keys`.

## 10. MongoDB usage

- Compound indexes align to alert inbox, dedupe, change, event, retrieval, and
  case-memory access paths.
- Flexible documents remain in `source_records` and `investigation_cases`.
- Top-level projections make case memory queryable without unpacking the full
  investigation result blob.

## 11. Acceptance criteria

- [x] Model indexes cover the current Workbench hot paths.
- [x] Fixture and seeded source records include tenant/environment metadata.
- [x] Created cases include top-level lookup fields.
- [x] Fault-domain candidates include score components.
- [x] Full smoke validates the new metadata and still resets cleanly.

## 12. Product risks

- Adding fields must not imply full production access control is complete.
- Indexes should remain small enough for the demo dataset while reflecting real
  production patterns.

## 13. Validation plan

- Backend import check for schemas/services.
- Targeted API check for case fields and score components.
- Frontend build to catch response-shape regressions.
- Full smoke through the existing `npm run smoke` path.

## 14. Implementation tasks

- [x] Add schema fields and indexes.
- [x] Add tenant/environment defaults to seeded and fixture records.
- [x] Project top-level case fields on case creation.
- [x] Add score component breakdowns.
- [x] Update docs/smoke and publish.

## 15. Decisions

- Keep `apex-health-supply` and `production` as defaults for this demo slice.
- Preserve existing unique keys to avoid disruptive index migration.

## 16. Roadmap priority

1. Similar-case retrieval from `investigation_cases`.
2. Server-side grounded follow-up Q&A.
3. Human approval request modeling.

## 17. Follow-ups

- Add actual tenant authorization only when authentication is introduced.
- Add agent run telemetry if the Workbench becomes a long-running agent runtime.