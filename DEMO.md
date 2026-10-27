# Find the Failure — Demo Runbook

**EDI Integration Impact Explorer.** A searchable, relationship-aware context
layer over the integration landscape. Answers *"What's affected, who owns it,
and what happens next?"* in seconds instead of hours.

> Key message: MongoDB does not replace Apex Health Supply's integration engines. It gives
> architects a flexible, searchable context layer above them.

---

## 1. Start the demo

First copy the config template: `cp .env.example .env`.

**Local (Docker):**

```bash
npm run demo
```

This starts MongoDB Atlas Local (with Atlas Search), seeds the data, and launches
the backend (`:4000`) and frontend (`:5173`). Open **http://localhost:5173**.

- Stop servers: `Ctrl+C`
- Stop the database: `npm run stop`
- Re-seed only: `npm run seed`

**MongoDB Atlas (cloud, no Docker):** set `MONGO_URI` in `.env` to your Atlas
SRV string (see the "Using MongoDB Atlas" section in `README.md`), then run
`npm run start:app`. Same talk track below — Atlas Search is built in.

Optional Atlas AI mode: set `ATLAS_RETRIEVAL_MODE=auto` and
`ENABLE_ATLAS_AUTO_EMBED_INDEX=true` only on an Atlas project where Automated
Embedding and Native Reranking are enabled.

### Pre-demo readiness checklist

Before presenting:

1. Start backend + frontend.
2. Wait for backend startup to report Search indexes queryable.
3. Run `npm run smoke` from the repository root.
4. Confirm the smoke output reports `ok: true`.
5. Open `http://localhost:5173` or `http://127.0.0.1:5173`.
6. Start in **Operations → Investigation Workbench**. Use the top **Next best
   action** coach and the left-side **Recommended flow** as the presenter guide.
   For an architecture audience, start in **Architecture → Catalog & Lineage**
   (section "Operational lineage for architects" below).

`npm run smoke` returns the demo to a clean rehearsal state by clearing
demo-feed alerts, lifecycle state, cases, simulated failures, the optional
enterprise fixture pack, and data-steward lineage decisions. Inventory and
lineage exports stay loaded.

---

## 2. Recommended hero path (≈6 minutes)

Open **Investigation Workbench**. The current hero flow is guided by three cues:

- the top **Next best action** card, which tells the operator exactly what to do
  next, and
- the left-side **Recommended flow**, which tracks replay context, select alert,
  open case, review evidence, and approve/close, and
- **Presenter Mode**, which keeps the default view summary-first while leaving
  proof panels available on demand.

Let the agent playbook populate topology, evidence, handoff, and local closure
state while you narrate the business value.

### Act 1 — Start from the business symptom
1. If the **Next best action** card says **Replay enterprise context**, click it.
   This loads Alertmanager, integration catalog, CMDB, and change fixture records,
   normalizes them, and groups repeated signals.
2. Select an external Alertmanager inbox item such as **ERP order API timeout**.
3. Say: "We are starting where operations starts: a rejected purchase order, not
   a static architecture diagram."
4. Click **Open investigation case** from either the selected-alert card or the
   top **Next best action** card.

### Act 2 — Let the summary lead
Presenter Mode keeps the audience focused on one consolidated **Investigation
summary**: priority, impact, likely issue, owner, why the answer is credible, and
the next safe check.

Open **Show investigation playbook and MongoDB proof** only when the audience asks
how the agent grounded the answer. The playbook still follows the same supervised
pattern for every alert, with case-specific evidence inside each phase:

- **Intake** — alert received, repeated signals grouped, and mapped to a known interface
- **Impact** — topology loaded and business impact assessed
- **Evidence** — related context, similar cases, recent changes, and provenance collected
- **Recommendation** — fault domains ranked and next checks generated

Expand the proof panel, then click a check to show the MongoDB collections and
query pattern behind it.

> "The human is supervising an investigation, not chatting with a generic bot."

### Act 3 — Reveal the connected topology
The graph renders the order path:

```
Hospital 123 → EDI Gateway → X12 Translator → Integration API → Apex ERP
      → Inventory Service / Order Status API / Partner Notifications
```

- Click a node or edge to show live metadata in the side panel.
- Point out owner, SLA, business data, recent events, and downstream context.

> "MongoDB stores this as a flexible operational context graph, so we can move
> from a business symptom to technical dependencies without hand-built screens."

### Act 4 — Show impact, evidence, and owner
1. Start with **Investigation summary**: priority, business impact, likely issue,
   owner, credibility signals, and first safe check. For the ERP order-create
   alert, point to **Data affected**: lineage shows the sales order may not be
   produced, so 12 downstream documents are at risk: the 855, 856, invoice,
   remittance, and cash application on the customer side, and the supplier PO
   documents through Supplier Payment on the procure-to-pay side. This exposes
   Hospital Invoicing and Cash Application and Supplier Invoice and Payment.
2. Point to the alert lifecycle tag: opening the case marks the alert
   **Investigating** in local Workbench state.
3. Point to the credibility list: grouped signals, recent changes, related
   context, similar cases, and evidence are summarized without filling the screen.
4. Open **Handoff preview and follow-up** to show the draft ITSM/escalation package: target
   queue, urgency, assignment group, impact, evidence, and approval guardrail.
5. Use **Operator action → Decision and closure** to record an approve, defer, or
   reject decision. Emphasize this is local case memory only; no external
   escalation was sent.
6. In the same **Operator action** panel, mark the case **Resolved**,
   **Monitoring**, or **Transferred**. The top stats update the **Case outcome**.
7. Open **Supporting evidence and audit trail** when the audience asks for more:
   grouped signals, similar prior cases, recent changes, related runbooks,
   grounding evidence, and the persisted case timeline are disclosed there.
8. Review the safe next checks. No remediation is executed in Agent v1; the
    guardrail reminds the audience that action requires operator approval.

> "In seconds we know what broke, what's downstream, who owns it, and what
> business process is exposed."

### Act 5 — Ask grounded follow-up questions
Open **Handoff preview and follow-up**, then use **Ask follow-up** to ask:

- "Why is this the likely fault domain?"
- "What business process is impacted?"
- "Who owns this interface?"
- "What changed recently?"
- "What is in the handoff preview?"
- "Are there similar prior cases?"
- "What evidence supports this?"
- "What should I check first?"

Answers are generated by the backend from the persisted case snapshot, then saved
back into `investigation_cases` with grounding labels and a MongoDB trace.

> "This is the agent-ready moment: MongoDB provides the auditable context layer
> needed for grounded investigation and human-approved remediation."

### Act 6 — Show case memory and audit trail
After the investigation completes, point to **Case memory** in the Alert Inbox
and **Supporting evidence and audit trail** in the right panel.

- Each investigation creates a persisted case record.
- The case stores the alert snapshot, summary, likely fault domain, evidence,
  recommended checks, approval decisions, case outcomes, timeline, and grounded
  follow-up Q&A.
- Follow-up Q&A is generated server-side from case memory rather than local
  browser helper logic.
- Later investigations can retrieve similar prior cases by interface, business
  process, fault domain, related context, and change keys.
- Selecting a saved case rehydrates the investigation context without rerunning
  the whole workflow.

> "The agent is not just answering in the moment. It is building an auditable
> investigation record that another operator can review later."

### Optional — Simulate more operational signals
1. In **Alert inbox**, open **Demo controls** and click **Add extra demo alerts**.
2. Point out that this is a targeted observability feed ingest, not a demo reset.
3. Point out the balanced feed: two alerts map to **Hospital Order Fulfillment**
   and two alerts map to **Supplier Replenishment**.
4. Select a different alert such as **X12 translation backlog**,
   **Partner notification publish failures**, or **Supplier EDI acknowledgment timeout**.
5. Click **Open investigation case** to show that the topology, likely fault
   domain, evidence, and next checks change with the alert context.
6. Use the selected alert lifecycle controls to acknowledge, escalate, resolve,
   or reopen locally. No ticket, page, or remediation is sent.
7. Click **Reset demo** when you want to reset the Workbench rehearsal state back
   to the original single-alert inbox and empty case memory.

### Optional — Manual workflow view
Open **More… → Presenter Console** to manually step through topology reveal,
failure injection, metadata normalization, and alert investigation.

### Optional — Enterprise context ingestion view
Go to **Platform → Context Ingestion** when the audience asks, "Where does the topology
come from, and can we trust it?"

1. Click **Load enterprise fixture pack** to capture Alertmanager,
   integration-catalog, and CMDB-style records as raw `source_records`.
2. Click **Normalize source records** to upsert typed `relationships` and
   alert `events` with provenance and an ingestion run id.
3. Use the pipeline and data-quality cards to show alias resolution,
   provenance coverage, trust score, stale evidence, inferred relationships,
   and ownership conflicts.
4. Point to the `lineage` records: integration-catalog lineage rows, the
   data-entity master, the trading-partner agreement, and the legacy lineage
   workbook. Every lineage edge in Catalog & Lineage is normalized from one of
   these raw records.
5. Click **Clear fixture pack** if you want to return to the default clean
   Workbench rehearsal state. Lineage exports are not part of the fixture pack
   and stay loaded.

In the **Investigation Workbench**, click **Replay enterprise context** to run
the same fixture capture/normalization path and immediately show three raw
Alertmanager signals collapsed into two external alert inbox items. The sidebar
and top coach now present this as the primary path: replay context, select alert,
open case, review evidence, then approve and close locally.

Open **Demo controls** only when you need **Add extra demo alerts** or **Reset
demo**. The scripted alerts are secondary rehearsal data; the enterprise context
pack is the primary ingestion story.

### Optional — Operational lineage for architects (≈3 minutes)
Use this when the audience asks, "How does order data actually move across our
systems?"

1. Go to **Architecture → Catalog & Lineage** and switch the lens to **Data view**.
2. **Purchase Order** is selected by default. Show the path to **Canonical
   Order**, **Sales Order**, **Order Acknowledgment**, **Advance Ship Notice**,
   **Invoice**, and **Payment Remittance**.
3. Point to the right panel: system of record, producers, consumers, and the
   interfaces that carry the entity.
4. Click a lineage edge (for example **Integration API to Apex ERP**) to show the
   transformation, owner, evidence, and field mappings with the PO number
   highlighted.
5. Open **Follow the PO number** to walk all nine hops from `X12 850 BEG03` to
   `CASH_APPLICATION.CUSTOMER_PO_REF`.
6. Point to the amber animated **Advance Ship Notice → Invoice** edge: it is
   inferred from a legacy lineage workbook at 60% confidence and needs SME
   confirmation.
7. Switch direction to **Upstream** on **Invoice** to answer "where did this
   invoice come from?"
8. Open **MongoDB proof** to show the `$graphLookup` pipeline over typed,
   tenant-scoped `transforms_to` relationships.
9. Point out **Data owner** (Order-to-Cash Data Stewardship) versus **Interface
   owner** (B2B Operations / ERP Integration), and the **Via** systems on
   outbound hops where translation steps are collapsed.
10. Point to **Source record** on a hop: each edge traces back to the raw
    lineage export it was normalized from.
11. Select **Sales Order** and click **Plan a change to Apex ERP →** to continue
    the architecture path in Modernization.

### Optional — Lineage governance (≈3 minutes)
Use this when architects or data-governance stakeholders ask, "Can this answer
for one real order, and who decides what is true?"

1. In **Follow the PO number**, pick **PO-4500012388**. The trace shows it was
   delivered through hop 3, **failed at Integration API → Apex ERP**, and that
   the remaining hops are blocked. The summary says the Sales Order may not be
   produced, and the amber line lists the 7 downstream documents not produced
   yet, from Inventory Request and the 855 through Invoice and Cash Application.
2. Pick **PO-4500012345** to contrast a completed order that reached cash
   application.
3. Click the amber **Advance Ship Notice → Invoice** edge and use **Data steward
   review → Confirm**. The inferred warning clears and the decision appears under
   **Steward decisions**. Use **Reject** to remove the edge from lineage. Use
   **Reset steward decisions** before the next rehearsal.
4. Click **Gateway to X12 Translation**: the hop shows mapping **v3 (X12
   005010)**. Set **As of** to `2025-01-01` to show the earlier **v2 (X12
   004010)** mapping (`canonical.order.po`).
5. Open **Standards mapping** to show the ArchiMate / OpenLineage mapping, then
   **Export this flow as OpenLineage RunEvents** for interoperability.

> "One model answers design-time and run-time lineage, with steward control over
> what counts as truth."

Sample orders are seeded B2B tracking events, not a live tracking feed.

> "This is operational lineage, not warehouse lineage: how business documents
> move and change shape across the integration landscape, with provenance on
> every edge."

Lineage is ingested from curated exports, not automated discovery.

### Optional — Procure-to-pay: same model, second flow (≈2 minutes)
Use this when architects ask, "Does this generalize beyond one flow?"

1. In the Data view, switch the flow picker to **Procure-to-pay**. **Purchase
   Requisition** is selected; show the path through the supplier 850, 855, 856,
   **Goods Receipt**, the supplier 810, the three-way **Invoice Match**, and
   **Supplier Payment**.
2. Point out that the identifier label now reads **Follow the supplier PO
   number**: all 6 hops carry it. The flow is a second `lineage_flows` document
   served by the same lineage services.
3. Pick **SPO-7700468**: it is **on hold at Supplier Invoice 810** because of a
   three-way match hold (invoiced 120 units, received 100). Invoice Match and
   Supplier Payment are not produced yet.
4. Pick **SPO-7700451** to contrast a completed supplier PO.
5. In **Modernization**, analyze **Apex ERP**: **Data Lineage Impact (all
   flows)** tags each transformation with its flow.

> "Adding a business flow is a data change, not a code change."

### Optional — Product recall traceability (≈3 minutes)
Use this when the audience asks, "If a manufacturer recalls a lot, how fast can
we answer who has it?"

1. Go to **Architecture → Recall Trace**. **RCL-2026-014** is selected: Class II,
   IV-220 Infusion Set, lot **L-2291**.
2. Show the totals: **300 received, 180 shipped, 120 on hand, 3 hospitals**, and
   the **Affected hospitals** table with orders, shipments, and units.
3. Open **Path of lot L-2291** to show the lot crossing from procure-to-pay
   (supplier 856, goods receipt) into order-to-cash (customer 856).
4. Point to **Untraceable by lot**: receipt **GR-51877** (250 units) was posted
   before the supplier 856 v2 mapping captured lot numbers.
5. In **Lot number coverage**, set **Mappings as of** to `2025-06-01`: the
   supplier 856 hop no longer carries the lot, which explains the gap. Click
   **Current** to return.
6. Show **Recommended actions** (quarantine, notify hospitals, block allocations,
   confirm with the supplier) and the read-only guardrail.

> "One lot number, traced across two flows, with the mapping history that tells
> you where traceability ends."

Recall data and hospitals are fictional sample data; no quarantine,
notification, or regulatory submission is executed.

### Optional — What-if modernization question
1. Go to **Architecture → Modernization** (or arrive from the Data view).
2. Select **X12 Translator** → **Analyze**.
3. Show affected interfaces, owners to coordinate, and downstream migration
   dependencies.
4. Scroll to **Data Lineage Impact**: the translator performs the Purchase Order
   → Canonical Order transformation (3 field mappings to rebuild), 8 downstream
   entities depend on it, and 4 outbound/inbound translation hops must be
   re-tested.

> "Before touching a component, see everything that depends on it."

---

## 3. MongoDB capabilities highlighted

| Capability | Where it shows up |
|---|---|
| Flexible documents | `interfaces` holds EDI, REST, FHIR, and event types in one collection |
| Atlas Search | Fuzzy, relevance-ranked search across all fields (⚡ badge) |
| Automated Embedding + Vector Search | Optional semantic retrieval over `operational_knowledge.text` |
| Native Reranking | Optional `$rerank` stage to reorder retrieved operational context |
| Relationship traversal | `$graphLookup` over `depends_on` edges in `relationships` builds the upstream/downstream dependency path |
| Operational lineage | `$graphLookup` over typed, tenant-scoped `transforms_to` edges traces order-to-cash entities; flexible `field_mappings` on edges hold X12/JSON/ERP field paths |
| Single edge store | Dependency, process, and lineage edges all live in `relationships`; interfaces embed no edges |
| Flows as data | `lineage_flows` documents define identifier, entity order, and path; procure-to-pay was added with no lineage-code change |
| Run-time tracing | Business-key index on `message_events` traces one order by PO number or supplier PO number against the flow path |
| Cross-flow identifier trace | Lot-number lookup on `message_events` with `$group` by customer answers recall questions across both flows |
| Versioned mappings | `mapping_versions` on edges answer "what was the mapping as of a date?" |
| Stewardship audit | `review` / `review_history` on edges; rejected edges filtered inside `$graphLookup` via `restrictSearchWithMatch` |
| Standards interoperability | ArchiMate / OpenLineage mapping and an OpenLineage RunEvent export generated from relationships |
| Federated ingestion | Raw inventory, process-map, lineage, CMDB, and observability records normalize into typed relationships/events |
| Evidence and provenance | Source records carry source id, adapter, alias resolution, trust level, and ingestion run metadata |
| Event history alongside metadata | `events` power "similar recent failures" |
| Production-shaped agent memory | Tenant/environment scope, query-aligned indexes, score components, and projected case fields |
| Human-in-the-loop workflow memory | `investigation_cases` stores handoff previews, approval decisions, case outcomes, timeline, and grounded Q&A |
| Foundation for AI | Same model can answer "what failed, who owns it, and what should we check next?" |

---

## 4. Data model

`systems`, `interfaces`, `data_entities`, `owners`, `events`,
`business_processes`, `relationships`, `source_records`, `operational_knowledge`,
`investigation_cases`, `lineage_flows`, and `message_events`.

`relationships` is the single canonical edge store for both dependency and
lineage traversal; interface documents do not embed graph edges.

Seeded footprint: **10 systems, 18 interfaces, 6 owners, 21 data entities**,
plus **4 business processes, 5 source records, 8 operational knowledge
documents, 2 lineage flows, 1 recall notice, 44 sample message events, 3 failure
scenarios**, and **1 modernization scenario**. Seed captures **2
inventory/process-map exports** and **24 lineage exports** as `source_records`
and normalizes them into **25 dependency/process relationships** and **91
order-to-cash, procure-to-pay, and recall lineage relationships**, all with
provenance.
The optional enterprise fixture pack adds **11 raw source records** for ingestion
demonstrations, including **3 external Alertmanager signals** that collapse into
**2 Workbench inbox items** and **3 recent change records** that power the Workbench
"What changed?" panel. It can be cleared without reseeding.

Operational agent records include tenant/environment scope for the fictional
`apex-health-supply` production tenant. Saved cases keep the complete
investigation result and also project queryable fields such as interface,
business process, dedupe group, related context, change keys, and confidence
score for future similar-case retrieval. Cases also persist local approval
decisions, case closure outcomes, grounded follow-up messages, and timeline
events. These records are demo-safe case memory only; no external ticket, page,
email, or remediation state is changed.

---

## 5. Architecture

- **Backend** — Node + Express + Mongoose (`backend/`). REST API under `/api`.
- **Frontend** — React + Vite + React Flow (`frontend/`).
- **Database** — MongoDB Atlas Local (mongod + Atlas Search) via `docker-compose.yml`.
- **Atlas AI optional** — Automated Embedding Vector Search and Native Reranking
  can be enabled through `.env` for Atlas cloud projects that support them.

```mermaid
flowchart LR
  sources[CMDB / Integration catalog / Observability / Runbooks]
  atlas[(MongoDB Atlas context layer)]
  search[Search + Vector Search + Rerank]
  graph[Typed relationships + graphLookup]
  workbench[Investigation Workbench]
  cases[(Case memory)]
  checks[Human-reviewed next checks]

  sources --> atlas
  atlas --> search
  atlas --> graph
  search --> workbench
  graph --> workbench
  workbench --> cases
  workbench --> checks
  cases --> workbench
```

Use **Operations → Investigation Workbench** as the primary story. For
architecture audiences, follow **Architecture → Catalog & Lineage →
Modernization → Recall Trace**. **Platform → Context Ingestion** shows where context comes
from; Presenter Console and Classic Investigation live under **More…**.

### Key endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/search?q=` | Cross-collection Atlas Search (regex fallback) |
| GET | `/api/interfaces/:key` | Full interface detail |
| GET | `/api/flow/:key` | Dependency graph (nodes + edges) |
| GET | `/api/impact/:key` | Downstream impact + owners + similar failures + lineage `data_impact` |
| POST | `/api/simulate/:key` | Inject a failure |
| POST | `/api/reset` | Restore pristine demo state |
| GET | `/api/scenarios` · POST `/api/scenarios/:id/run` | Named failure scenarios |
| GET | `/api/modernization/:systemKey` | What-if impact of replacing a system + `lineage_impact` |
| GET | `/api/lineage/flows` · `/api/lineage/flows/:flowKey` | Lineage flow documents and ordered "follow the identifier" path |
| GET | `/api/lineage/entities?flow=` · `/api/lineage/:entityKey?as_of=` | Flow entities and upstream/downstream lineage (mapping version as of a date) |
| GET | `/api/lineage/flows/:flowKey/transactions/:value` | Single-order trace aligned to the flow path |
| POST | `/api/lineage/edges/:edgeKey/review` · `/api/lineage/reviews/clear` | Data-steward confirm/reject; reset decisions |
| GET | `/api/lineage/metamodel` · `/api/lineage/flows/:flowKey/openlineage` | ArchiMate/OpenLineage mapping; OpenLineage export |
| GET | `/api/lineage/identifiers/:identifier/coverage` · `/api/lineage/identifiers/:identifier/:value` | Identifier coverage per hop; trace one value across flows |
| GET | `/api/recalls` · `/api/recalls/:recallId?as_of=` | Recall notices and lot trace with recommended actions |
| GET/POST | `/api/ingestion` · `/api/ingestion/run` | Raw source records, pipeline, quality, and normalization |
| POST | `/api/ingestion/fixtures` · `/api/ingestion/fixtures/clear` | Load/clear optional enterprise fixture pack |
| GET | `/api/alerts` | Deduplicated Workbench inbox items with raw signal counts |
| POST | `/api/alerts/demo-feed` | Add/refresh optional scripted observability alerts |
| POST | `/api/alerts/:sourceRecordKey/lifecycle` | Local Workbench lifecycle transition |
| GET/POST | `/api/cases` · `/api/cases/investigate/:sourceRecordKey` | Persist and list investigation cases |
| POST | `/api/cases/:caseKey/messages` | Generate and persist backend-grounded follow-up Q&A |
| POST | `/api/cases/:caseKey/approval-decision` | Record local approve/defer/reject handoff decisions |
| POST | `/api/cases/:caseKey/outcome` | Record local resolved/monitoring/transferred case outcomes |
| POST | `/api/workbench/clear-demo-state` | Clear simulated feed alerts, lifecycle state, and case memory |

---

## 6. Troubleshooting

- **Search shows no ⚡ badge / `engine: regex`** — the search index is still
  building; wait ~15s and retry. The app falls back to regex so it never breaks.
- **Port already in use** — a previous run is still up; `npm run stop` and re-run.
- **Reset the whole dataset** — `npm run seed`.
- **Verify the whole demo** — `npm run smoke` exercises the main API paths and
  returns the demo to a clean state.
- **Lineage shows an edge as confirmed/rejected from a previous rehearsal** — use
  **Reset steward decisions** in the Data view, or `POST /api/lineage/reviews/clear`.
- **"As of" shows the current mapping** — only the X12 translation and ERP
  order-create hops carry earlier versions; pick a date before 2026-03-01 or
  2025-06-01 respectively.
- **Order trace picker is empty** — reseed with `npm run seed`; sample
  `message_events` are created at seed time.
- **ERP order-create failure shows 12 documents at risk, not 5** — expected.
  Data impact follows the existing ERP → Supplier Replenishment dependency into
  procure-to-pay documents.
