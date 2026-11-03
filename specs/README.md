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

Use this lifecycle in each spec front matter:

1. `draft` — problem and requirements are still being shaped.
2. `accepted` — the demo owner approved scope and acceptance criteria.
3. `implemented` — code/docs have been changed.
4. `validated` — every acceptance criterion is checked and demo behavior is confirmed.
5. `superseded` — replaced by a later spec (`superseded_by` is required).

**Gate:** a spec is committed as `draft` on its own, and implementation starts
only after the demo owner approves it and it is marked `accepted`. Specs created
before 2026-10-31 were written in the same commit as their code; they are not
retroactively gated.

## Front matter and links

Front matter starts on line 1 (see [`template.md`](./template.md)):

- `created` / `updated` — `updated` changes when requirements, decisions, or
  status change.
- `baseline_tag` — an existing git tag marking the validated state or the
  baseline the change builds on, or `none`.
- `depends_on` — specs this one requires.
- `amends` / `amended_by` — partial changes to an earlier spec. Both sides list
  each other, and the amended spec has an **Amendments** section saying which
  requirements changed and where current behaviour is described.
- `supersedes` / `superseded_by` — full replacement.

Scope added after a spec is `implemented` goes in a new spec or a dated
amendment, not into the existing requirement list.

## Requirement traceability

Automated tests reference the requirements they check in their test name or
assertion message, as `[<spec>:REQ-001]` or `[<spec>:REQ-001,REQ-002]`:

~~~js
it("[ux-clarity:REQ-010] opens linked orders in the Data view", ...);
assert(ok, "[procure-to-pay:REQ-010] held supplier PO trace incorrect");
~~~

`npm run spec:check` validates front matter, baseline tags, links, and
duplicate IDs; fails if a `validated` spec has unchecked acceptance criteria or
a test references an unknown requirement; and reports, per spec, which
requirements no automated test references. `npm run spec:check -- --strict`
also fails on untested requirements in `validated` specs. Requirements checked
manually say so in the spec's acceptance criteria.

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

- [`operations-workbench`](./operations-workbench/spec.md) — baseline Workbench journey (amended by `ux-clarity`)
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

- [`operational-lineage`](./operational-lineage/spec.md) — order-to-cash Data view (amended by `architecture-integrity`, `procure-to-pay`)
- [`lineage-integration`](./lineage-integration/spec.md) — data impact, lineage-aware Modernization, modelling fixes
- [`architecture-integrity`](./architecture-integrity/spec.md) — ingested lineage, single edge store, flows as data, grouped navigation
- [`lineage-governance`](./lineage-governance/spec.md) — order tracing, steward review, versioned mappings, standards
- [`procure-to-pay`](./procure-to-pay/spec.md) — second lineage flow on the supplier side, supplier PO tracing
- [`product-recall-traceability`](./product-recall-traceability/spec.md) — lot trace across both flows, lot coverage, Recall Trace view

**Cross-cutting**

- [`ux-clarity`](./ux-clarity/spec.md) — answer-first architecture screens, tabbed Data view, as-of banner, legend, 12px font floor, cross-screen links, loading/retry states, Workbench triage/case steps (`implemented`; build and smoke pass, manual visual pass pending)
- [`mongodb-hygiene`](./mongodb-hygiene/spec.md) — `$jsonSchema` validators (warn), index cleanup with `syncIndexes()`, tenant-scoped hot-path queries, explicit connection settings
- [`mongodb-transactions`](./mongodb-transactions/spec.md) — all-or-nothing multi-document write flows
- [`bounded-history-arrays`](./bounded-history-arrays/spec.md) — `$slice` caps on every history array
- [`business-key-attribute-pattern`](./business-key-attribute-pattern/spec.md) — one `{k, v}` index for every business identifier in `message_events` (amends `lineage-governance`, `product-recall-traceability`)
- [`requirement-test-backfill`](./requirement-test-backfill/spec.md) — tagged smoke assertions, backend test suite, list of untested requirements and why
- [`local-demo-startup`](./local-demo-startup/spec.md) — search-index retry, auto-embedding readiness, empty-vector fallback, port 27017 check (`implemented`; all checks pass except the docs review, REQ-007)
- [`navigation-routing`](./navigation-routing/spec.md) — hash URLs for every screen and cross-screen link, Back/Forward, remove Classic Investigation; amends `architecture-integrity` (`implemented`; manual Back/Forward check pending)
- [`demo-outcome-targets`](./demo-outcome-targets/spec.md) — click targets and API time budgets for the three hero questions, warnings in smoke (`implemented`; Atlas Local baseline and doc review pending)

## Change discipline

For future work, use this flow:

1. Draft the spec and commit it as `draft`.
2. The demo owner reviews scope and acceptance criteria; mark it `accepted`.
3. Implement the smallest useful slice; tag tests with `[<spec>:REQ-…]`.
4. Run the validation plan and `npm run spec:check`.
5. Update the spec status, `updated`, and follow-ups; create the baseline tag
   when the spec is `validated`.

The current baseline is captured in
[`operations-workbench/spec.md`](./operations-workbench/spec.md), tagged as
`operations-workbench-2026-09-16`.