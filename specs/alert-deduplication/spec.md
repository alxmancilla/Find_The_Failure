# Alert Deduplication / Noise Reduction Spec

---
status: validated
owner: demo-team
created: 2026-09-16
updated: 2026-09-16
release_type: next demo enhancement
baseline_tag: operations-workbench-2026-09-16
---

## 1. Problem

The Workbench now handles alert lifecycle and change correlation, but repeated
observability signals can still make the inbox feel noisy. Operations users need
to see one actionable alert group while preserving the raw duplicate signals as
evidence.

## 2. Users and audience

- Primary user: operations analyst or integration support engineer.
- Secondary users: incident commander, support lead, enterprise architect.
- Demo audience: operations leaders, SRE/support teams, platform stakeholders.

## 3. Goals

- Collapse repeated alert signals into one Workbench alert card.
- Preserve all raw alert `source_records` for audit and evidence.
- Show duplicate signal count and contributing sources in the UI.
- Keep deduplication deterministic, transparent, and demo-safe.

## 4. Product outcomes

- Operators can focus on one actionable alert instead of repeated noise.
- Support leads can still inspect all source signals behind the grouped alert.
- The demo shows MongoDB as both raw evidence store and operational view layer.
- The Workbench feels more like a calm operations queue as fixtures grow.

## 5. Demo success criteria

- Enterprise replay loads duplicate raw Alertmanager signals.
- The inbox shows one grouped alert card for duplicate signals.
- The alert card and selected alert panel show the grouped signal count.
- Investigation results and case memory preserve the dedupe snapshot.

## 6. Non-goals

- Do not build production incident correlation or alert routing policy.
- Do not drop, delete, or mutate raw duplicate alert records.
- Do not integrate with external alert manager silencing APIs.
- Do not add another top-level Workbench control.

## 7. Requirements

- **REQ-001:** Alert listing shall preserve raw alert count metadata.
- **REQ-002:** Alert listing shall collapse duplicate signals by deterministic
  group key.
- **REQ-003:** Alert cards shall show grouped signal count when count > 1.
- **REQ-004:** Investigation results shall include `alert_deduplication`.
- **REQ-005:** Case timeline shall include a deduplication step.
- **REQ-006:** MongoDB stage explanations shall show the dedupe query pattern.
- **REQ-007:** Deduplication shall never remove raw `source_records`.

## 8. UX design

Keep noise reduction compact. Show a small "N signals" pill on grouped alert
cards and a short "Noise reduction" panel in the active case area. Use calm copy:
"Grouped signals" rather than "duplicates discarded".

## 9. Data and API design

Use existing alert `source_records` and optional `payload.alert_group_key`.

`GET /api/alerts` adds:

- `raw_alerts_count`
- `suppressed_alerts_count`
- collapsed `alerts[]` with `dedupe` metadata

Investigation responses add:

- `alert_deduplication.group_key`
- `alert_deduplication.signal_count`
- `alert_deduplication.duplicate_signals[]`

## 10. MongoDB usage

- Raw alerts stay in `source_records` as flexible source evidence.
- A MongoDB `find` loads candidate alert records for grouping.
- Service-layer grouping creates a calm operational view without losing source
  fidelity.
- `investigation_cases` persist the dedupe snapshot for auditability.

## 11. Acceptance criteria

- [x] Enterprise fixture pack includes duplicate raw alert signals.
- [x] `GET /api/alerts` returns collapsed cards and raw/suppressed counts.
- [x] Grouped alert cards show signal count.
- [x] Investigation results include dedupe metadata and trace.
- [x] Case timeline includes a deduplication event.
- [x] Full smoke validates dedupe and resets cleanly.

## 12. Product risks

- Collapsing alerts could hide useful nuance unless signal details remain visible.
- Demo copy must avoid implying production-grade incident correlation policy.
- Dedupe grouping keys must be deterministic for repeatable demos.

## 13. Validation plan

- API check: replay fixtures and verify raw alert count exceeds visible cards.
- Investigation check: open grouped alert and verify dedupe snapshot.
- Frontend check: `cd frontend && npm run build`.
- Smoke check: `npm run smoke`.
- Live rehearsal check: replay enterprise context and verify grouped signal count.

## 14. Implementation tasks

- [x] Add duplicate alert fixture signals.
- [x] Add backend alert grouping and investigation dedupe metadata.
- [x] Add Workbench grouped signal UI and dedupe playbook step.
- [x] Update docs/specs and full smoke coverage.
- [x] Validate and publish.

## 15. Decisions

- Group in the service layer rather than creating a new incident collection.
- Prefer explicit fixture `alert_group_key`, with deterministic fallback grouping.
- Keep raw signals auditable in `source_records`.

## 16. Roadmap priority

1. Implement lightweight alert deduplication/noise reduction.
2. Consider ITSM handoff only if demo scope expands.

## 17. Follow-ups

- Add production alert-correlation policy design only if required.
- Consider surfacing dedupe history in case timeline details.