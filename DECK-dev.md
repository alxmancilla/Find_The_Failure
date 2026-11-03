---
marp: true
title: Find the Failure — MongoDB patterns for operational graphs and lineage
paginate: true
---

# One question, three MongoDB patterns
### Find the Failure: an operational context layer on MongoDB

20 minutes · live demo · code you can reuse

<!-- Audience: developers. Keep the domain light; the glossary is on the last slide. -->

---

## The question (live, 2 minutes)

> A manufacturer recalls lot **L-2291**. Which hospitals received it,
> and how much is still in our warehouse?

**Recall Trace** answers in one click:
lot L-2291 reached **3 hospitals**, **120 units** are on hand, and
**1 receipt (250 units)** can't be traced by lot.

The answer crosses two business flows (buying from suppliers, selling to
hospitals) and six systems. Here is how MongoDB gets there.

<!-- Fallback if the cluster is paused: show the recorded run. -->

---

## Pattern 1 — one edge store, traversed with `$graphLookup`

Dependencies, process links, and data lineage are all documents in **one**
`relationships` collection: `{ from_key, to_key, relationship_type, ... }`.

```js
{ $graphLookup: {
    from: "relationships", startWith: "$key",
    connectFromField: "to_key", connectToField: "from_key",
    as: "downstream", maxDepth: 10, depthField: "depth",
    restrictSearchWithMatch: { relationship_type: "transforms_to",
      "review.status": { $ne: "rejected" }, tenant_id, environment } } }
```

- `restrictSearchWithMatch` keeps one walk to one edge type, one tenant, and
  excludes edges a data steward rejected.
- Index the field the recursion queries: `{ from_key, relationship_type, tenant_id, environment }`.
- `maxDepth` bounds the walk; `$graphLookup` must fit in 100 MB per stage.

---

## Pattern 2 — the attribute pattern: one index for any identifier

Tracking events carry different keys: PO number, supplier PO, lot, device ID.
One index per key does not scale. Store them as pairs as well:

```js
business_keys:           { po_number: "PO-1", lot_number: "L-2291" }
business_key_attributes: [{ k: "po_number", v: "PO-1" }, { k: "lot_number", v: "L-2291" }]

// one index serves every identifier
{ tenant_id: 1, environment: 1, "business_key_attributes.k": 1, "business_key_attributes.v": 1, observed_at: 1 }

// query with $elemMatch so k and v come from the same pair
find({ tenant_id, environment,
       business_key_attributes: { $elemMatch: { k: "lot_number", v: "L-2291" } } })
```

`explain()` → `IXSCAN` on that one index for all five lookup shapes. Four
per-identifier indexes were dropped; a new identifier needs no new index.

---

## Pattern 3 — evolve the schema safely

| Need | Pattern |
|---|---|
| Catch bad writes without breaking old data | `$jsonSchema` validator, `validationLevel: "moderate"`, `validationAction: "warn"`; log the count of non-matching documents |
| Arrays that would grow forever | `$push: { history: { $each: [entry], $slice: -20 } }` keeps the newest 20 |
| Multi-document writes | `connection.transaction(fn)`; Mongoose passes the session automatically with `transactionAsyncLocalStorage` |
| Indexes removed from code | `Model.syncIndexes()` on startup drops what the schema no longer declares |

**Gotchas:** Atlas Search can't run inside a transaction, so search happens
before the writes. Operations on one session must be sequential (no `Promise.all`).

---

## How we know it works

- `npm run smoke` — end-to-end API run, resets the demo afterwards
- `cd backend && npm test` — 31 tests, 21 against the database: rollback leaves
  nothing behind, caps hold, validators flag bad documents, `explain()` uses
  the intended index
- `npm run spec:check` — every spec requirement ID is matched to the tests
  that reference it: **135 of 188** covered; the rest are listed with a reason

```js
it("[mongodb-transactions:REQ-005] rolls back every write when the flow fails", ...)
```

---

## Try it

```bash
git clone https://github.com/alxmancilla/Find_The_Failure.git
cd Find_The_Failure && cp .env.example .env
npm run demo        # Docker: MongoDB Atlas Local + seed + backend + frontend
npm run smoke       # in a second terminal
```

Open `http://localhost:5173` → **Architecture → Recall Trace**.
Atlas Local includes Atlas Search; no cloud account needed.
Port 27017 must be free; the first start pulls the image and takes a few minutes.

Code: `backend/src/services/lineage.js` (Pattern 1) ·
`backend/src/models.js` (Pattern 2) · `backend/src/db.js`,
`dbSetup.js`, `historyLimits.js` (Pattern 3)

---

## Questions

**What it is:** seeded sample data, read-only, deterministic investigation
workflow (no LLM tool calling), single tenant, not load-tested.

**Glossary** — EDI documents: 850 purchase order · 855 order acknowledgment ·
856 ship notice · 810 invoice · 820 payment. Three-way match: purchase order,
goods receipt, and invoice must agree before paying. UDI: unique device identifier.

Longer version for architects: [`DECK.md`](./DECK.md) · runbook: [`DEMO.md`](./DEMO.md)
