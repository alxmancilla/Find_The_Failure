# Spec-Driven Design

This repository uses lightweight spec-driven design for demo changes. The goal is
to make every meaningful change intentional, reviewable, and easy to validate
without slowing down demo iteration.

## When to write a spec

Write or update a spec before changing behavior when the change affects:

- the Investigation Workbench user journey
- ingestion, provenance, trust scoring, or data quality
- MongoDB query/trace storytelling
- backend API contracts or response shapes
- seeded data used in the presenter flow
- demo positioning, operating model, or acceptance criteria

Tiny copy fixes, formatting fixes, and bug fixes with no product impact can be
committed directly, but the related spec should be updated if the fix changes
expected behavior.

## Spec lifecycle

Use this lifecycle in each spec frontmatter:

1. `draft` — problem and requirements are still being shaped.
2. `accepted` — ready to implement.
3. `implemented` — code/docs have been changed.
4. `validated` — tests/smoke checks pass and demo behavior is confirmed.

## Required structure

Each spec should include:

- problem statement
- target users and demo audience
- goals and non-goals
- product outcomes and demo success criteria
- numbered requirements
- UX/API/data design notes
- acceptance criteria
- product risks and roadmap priority
- validation plan
- implementation tasks
- decisions and follow-ups

Use [`template.md`](./template.md) for new specs.

## Naming convention

Create specs under `specs/<short-feature-name>/spec.md`.

## Spec index

Specs below are `validated` unless marked otherwise.

**Operations (Investigation Workbench)**

- [`operations-workbench`](./operations-workbench/spec.md) — baseline Workbench journey
- [`operational-priority`](./operational-priority/spec.md) — priority and SLA risk
- [`alert-lifecycle`](./alert-lifecycle/spec.md) — local alert lifecycle states
- [`change-correlation`](./change-correlation/spec.md) — "What changed?" evidence
- [`alert-deduplication`](./alert-deduplication/spec.md) — grouped alert signals
- [`mongodb-agent-hardening`](./mongodb-agent-hardening/spec.md) — tenant scope, indexes, case projections
- [`similar-case-retrieval`](./similar-case-retrieval/spec.md) — prior case memory
- [`grounded-follow-up-qa`](./grounded-follow-up-qa/spec.md) — backend-grounded follow-up
- [`itsm-handoff-preview`](./itsm-handoff-preview/spec.md) — read-only escalation package
- [`operator-approval-decision-log`](./operator-approval-decision-log/spec.md) — local approve/defer/reject
- [`case-closure-outcomes`](./case-closure-outcomes/spec.md) — local case outcomes
- [`workbench-simplification`](./workbench-simplification/spec.md) — Presenter Mode

**Architecture (lineage)**

- [`operational-lineage`](./operational-lineage/spec.md) — order-to-cash Data view
- [`lineage-integration`](./lineage-integration/spec.md) — data impact, lineage-aware Modernization, modelling fixes
- [`architecture-integrity`](./architecture-integrity/spec.md) — ingested lineage, single edge store, flows as data, grouped navigation
- [`lineage-governance`](./lineage-governance/spec.md) — order tracing, steward review, versioned mappings, standards
- [`procure-to-pay`](./procure-to-pay/spec.md) — second lineage flow on the supplier side, supplier PO tracing
- [`product-recall-traceability`](./product-recall-traceability/spec.md) — lot trace across both flows, lot coverage, Recall Trace view

**Cross-cutting**

- [`ux-clarity`](./ux-clarity/spec.md) — answer-first architecture screens, tabbed Data view, as-of banner, legend, 12px font floor (`implemented`; build and smoke pass, manual visual pass pending)

## Change discipline

For future work, use this flow:

1. Draft or update the spec.
2. Review scope and acceptance criteria.
3. Implement the smallest useful slice.
4. Run the validation plan.
5. Update the spec status and follow-ups.

The current baseline is captured in
[`operations-workbench/spec.md`](./operations-workbench/spec.md), tagged as
`operations-workbench-2026-09-16`.