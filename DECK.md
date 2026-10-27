---
marp: true
title: Find the Failure — Integration Intelligence on MongoDB
paginate: true
---

# Find the Failure
### Integration intelligence for Apex Health Supply, on MongoDB

What failed, what is affected, who owns it, and what to check next — in seconds.

<!-- Apex Health Supply is a fictional healthcare supply distributor. All data is seeded sample data. -->

---

## The problem

- A rejected hospital order crosses an EDI gateway, an X12 translator, an
  integration API, and the ERP before anyone sees it fail.
- Knowing the blast radius means checking CMDB exports, integration catalogs,
  spreadsheets, and tribal knowledge.
- Change planning has the same gap: "If we replace this system, what breaks?"
- Data questions are harder still: "Where is this order?" "Which hospitals
  received this recalled lot?"

---

## What the demo is

An **operational context layer** on MongoDB that sits beside existing
integration engines — it does not replace them.

- **Operations:** Investigation Workbench — alert to impact, owner, and safe next check
- **Architecture:** Catalog & Lineage, Modernization, Recall Trace
- **Platform:** Context Ingestion — how raw exports become trusted context

Read-only and human-supervised: nothing is sent to ITSM, paging, or remediation.

---

## Architecture

```mermaid
flowchart LR
  sources[CMDB / catalog / observability / lineage exports]
  atlas[(MongoDB Atlas context layer)]
  search[Atlas Search + Vector Search]
  graph[Typed relationships + $graphLookup]
  ui[Workbench · Lineage · Modernization · Recall]
  cases[(Case memory)]
  sources --> atlas --> search --> ui
  atlas --> graph --> ui
  ui --> cases --> ui
```

Node + Express + Mongoose backend · React + Vite + React Flow frontend.

---

## Data model: 12 collections

| Group | Collections |
|---|---|
| Estate | `systems`, `interfaces`, `owners`, `business_processes`, `data_entities` |
| Graph | `relationships` — the **single store** for every edge |
| Evidence | `source_records`, `events`, `operational_knowledge` |
| Lineage | `lineage_flows`, `message_events` |
| Memory | `investigation_cases` |

- One flexible `interfaces` collection holds EDI, REST, FHIR, event, and SFTP.
- Every edge traces back to a raw source record with provenance.

---

## Act 1 — Investigation Workbench

1. **Replay enterprise context** — Alertmanager, catalog, CMDB, and change records
   are ingested; repeated signals collapse into one inbox item.
2. Select **ERP order API timeout** → **Open investigation case**.
3. The agent playbook runs: grouped signals → mapped interface → topology →
   impact → related context → similar cases → recent changes → ranked fault domain.

> "We start where operations starts: a rejected purchase order."

---

## Act 2 — Triage, then Case

**1. Triage**
- Investigation summary: priority, business impact, likely issue, owner, next safe check
- **Data affected:** 12 downstream documents at risk across both flows

**2. Case**
- Read-only ITSM handoff preview
- Grounded follow-up Q&A answered from the saved case
- Local approve / defer / reject and resolved / monitoring / transferred
- Full case audit trail; similar cases are reused next time

---

## Act 3 — Operational lineage (Data view)

- **Answer line:** "Purchase Order · 9 connected documents · ✓ confirmed ·
  ⚠ 1 inferred · PO number on 9/9 hops"
- Click a hop: transformation, field mappings, owners, system of record, source record
- **Trace** tab: follow PO-4500012388 — failed at Integration API → Apex ERP,
  7 documents not produced → **Investigate in the Workbench →**
- **Proof** tab: the `$graphLookup` pipeline over `transforms_to` edges

> "Operational lineage, not warehouse lineage."

---

## Act 4 — Governance

- **Data steward review:** confirm or reject the inferred ASN → Invoice edge
  (60% confidence, legacy workbook); decisions are audited and survive re-ingestion
- **Versioned mappings:** set "Mappings as of" 2025-01-01 to see X12 004010 (v2)
  instead of 005010 (v3)
- **Standards:** ArchiMate / OpenLineage mapping and an OpenLineage RunEvent export

---

## Act 5 — Same model, second flow

**Procure to Pay**: requisition → supplier 850 / 855 / 856 → goods receipt →
supplier 810 → three-way match → supplier payment.

- Added as a `lineage_flows` **document** — no lineage code change
- SPO-7700468 is **on hold** at the three-way match (invoiced 120, received 100)
- Modernization aggregates lineage impact across both flows

> "Adding a business flow is a data change, not a code change."

---

## Act 6 — Product recall traceability

**RCL-2026-014 · Class II · IV-220 Infusion Set · lot L-2291**

> Lot L-2291 reached **3 hospitals**. **120 units** are still on hand.
> ⚠ **1 receipt (250 units)** cannot be traced by lot.

- Recommended actions first: quarantine, notify hospitals, block allocations,
  confirm with the supplier — read-only
- Evidence: 300 received, 180 shipped; the lot path crosses procure-to-pay into
  order-to-cash; click a PO to open its trace
- "Mappings as of 2025-06-01" shows why GR-51877 is untraceable: the supplier
  856 did not carry the lot before mapping v2

---

## Act 7 — Modernization

"What would be impacted if we replaced the X12 Translator?"

- Affected interfaces, owners to coordinate, downstream migration dependencies
- **Data Lineage Impact (all flows):** transformations and field mappings to
  rebuild, entities that depend on them, translation hops to re-test
- Click a flow badge to open that transformation in the Data view

> "Before touching a component, see everything that depends on it."

---

## MongoDB capabilities shown

| Capability | Where |
|---|---|
| Flexible documents | EDI, REST, FHIR, event interfaces in one collection |
| Atlas Search | Fuzzy, typo-tolerant search across the estate |
| Vector Search + rerank (optional) | Related runbooks and incident notes |
| `$graphLookup` | Dependency impact and lineage traversal over one edge store |
| Business-key indexes | One order, supplier PO, or lot traced across flows |
| Versioned subdocuments | Effective-dated mappings answer "as of" questions |
| Provenance | Every edge links to its raw source record and ingestion run |
| Case memory | Auditable investigations, decisions, and grounded Q&A |

---

## What is real, and what is sample

**Implemented and tested**
- Ingestion pipeline, typed edge store, traversal, impact, lineage, steward
  review, versioned mappings, OpenLineage export, recall trace, case memory
- `npm run smoke` (API end to end) · `cd frontend && npm test` (14 component tests)

**Sample data, by design**
- Fictional company, seeded exports and alerts
- Order, supplier PO, and lot tracking events are seeded, not a live feed
- Agent v1 is deterministic and read-only; no LLM tool orchestration

---

## A PoC would prove

1. **Time to answer:** alert → impact, owner, next check in under 30 seconds
2. **Accuracy:** impact and lineage match an SME-signed validation set
3. **Real ingestion:** one integration inventory, one CMDB, one observability source
4. **Graph scale:** `$graphLookup` within limits on the real graph shape
5. **Optional:** runtime order tracing and recall traceability on real B2B data

Scope: one critical order flow, 8–12 weeks, read-only.

---

## Questions

- Which incident or change would you test first?
- Which business identifiers matter most: PO, supplier PO, lot, UDI?
- Who would sign off the validation set?

**Run it:** `npm run start:app` → `http://localhost:5173`
**Runbook:** [`DEMO.md`](./DEMO.md) · **Data model:** [`DATA_MODEL.md`](./DATA_MODEL.md)
