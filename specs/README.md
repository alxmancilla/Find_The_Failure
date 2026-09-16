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
- numbered requirements
- UX/API/data design notes
- acceptance criteria
- validation plan
- implementation tasks
- decisions and follow-ups

Use [`template.md`](./template.md) for new specs.

## Naming convention

Create specs under `specs/<short-feature-name>/spec.md`.

Examples:

- `specs/operations-workbench/spec.md`
- `specs/alert-lifecycle/spec.md`
- `specs/change-correlation/spec.md`

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