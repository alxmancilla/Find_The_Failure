---
status: accepted
owner: demo-team
created: 2026-10-31
updated: 2026-10-31
release_type: platform hardening
baseline_tag: none
depends_on: []
amends: []
---

# MongoDB Transactions Spec

## 1. Problem

Seven write flows change several documents in separate writes. A crash or
network error part-way leaves the demo half-updated (for example, an interface
marked failed with no failed event, or events deleted but the seed history not
restored). `POC.md` lists this as gap AV5.

## 2. Users and audience

- Primary: MongoDB SAs and architects reviewing the data layer.
- Secondary: presenters relying on reset and rehearsal flows.

## 3. Goals

- Make each multi-document write flow all-or-nothing.
- Keep reads that cannot run in a transaction (Atlas Search) outside it.

## 4. Product outcomes

- No partial demo state after a failed write flow.
- Reviewers can see where and why transactions are used.

## 5. Demo success criteria

- Smoke results unchanged.
- An automated test shows a failed transaction leaves no writes behind.

## 6. Non-goals

- Seed (it drops and reloads everything and runs DDL such as `collMod`).
- Single-document updates, which are already atomic (steward review, case
  approval/outcome/follow-up, alert lifecycle on its own).

## 7. Requirements

- **REQ-001:** A shared `withTransaction(fn)` helper runs `fn` in a MongoDB
  transaction with `readConcern: "snapshot"` and `writeConcern: "majority"`,
  retries transient errors, and passes the session to every Mongoose operation
  inside `fn` automatically.
- **REQ-002:** Operations inside a transaction run sequentially (no
  `Promise.all`), as MongoDB does not support parallel operations on one session.
- **REQ-003:** These flows run their writes in one transaction each:
  failure simulation, demo reset (`resetStatuses`), ingestion run
  (`runIngestion`), clear enterprise fixtures, clear Workbench demo state,
  clear steward decisions, and opening a case (alert lifecycle + case insert).
- **REQ-004:** Reads that use Atlas Search, and response-building reads after
  the writes, run outside the transaction.
- **REQ-005:** If any write in a flow fails, none of the flow's writes persist.

## 8. UX design

None.

## 9. Data and API design

No API or response changes.

## 10. MongoDB usage

`connection.transaction()` with Mongoose `transactionAsyncLocalStorage`;
multi-document ACID transactions on the replica set (Atlas or Atlas Local).

## 11. Acceptance criteria

- [ ] REQ-001, REQ-005 — automated: `backend/test/transactions.test.mjs`
  (writes through several operation types, then throws; nothing persists).
- [ ] REQ-002, REQ-003, REQ-004 — manual: code review of the listed flows, by
  demo-team.
- [ ] `npm run smoke` passes with unchanged results.

## 12. Product risks

- Transactions have a 60-second default limit; ingestion is far below it at
  demo volume but must be re-checked at real volume.
- A flow that accidentally calls Atlas Search inside a transaction fails.

## 13. Validation plan

`cd backend && npm test`, `npm run smoke`, `npm run spec:check`.

## 14. Implementation tasks

- [ ] Helper and async-local-storage setting.
- [ ] Wrap the seven flows; make their writes sequential.
- [ ] Transaction rollback test.
- [ ] Docs and spec status.

## 15. Decisions

- Accepted in advance by the demo owner on 2026-10-31 ("draft the specs, then
  implement"); the draft was not reviewed separately.

## 16. Roadmap priority

1. Re-check transaction duration at representative volume.

## 17. Follow-ups

- Transactional seed via a staging database and rename, if needed.
