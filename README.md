# Find the Failure

**An EDI Integration Impact Explorer** — a bounded Agent v1 PoC/demo with a
searchable, relationship-aware context layer over an integration landscape. It
answers *"What's affected, who owns it, and what happens next?"* in seconds
instead of hours.

> MongoDB does not replace existing integration engines (e.g. Apex Health Supply's). It
> gives architects a flexible, searchable context layer **above** them so they
> can understand how the landscape fits together.

For a step-by-step presenter walkthrough, see [`DEMO.md`](./DEMO.md). For future
changes, use the lightweight spec workflow in [`specs/`](./specs/).

> **Positioning:** this repository is an early-stage, seeded PoC. It demonstrates
> the operating model and MongoDB fit; production readiness still requires real
> source ingestion, SME-validated truth data, security/governance controls, and
> scale testing.

---

## Recommended demo path

The **Investigation Workbench** is the hero experience. Use the other tabs as
supporting views only when the audience wants to go deeper.

1. Start from an operational alert in the Workbench.
2. Use the default Presenter Mode summary to answer: what happened, what is
   impacted, and what should we do next?
3. Show how MongoDB maps the alert to a canonical interface and dependency graph.
4. Open the proof panels only when the audience asks for MongoDB traces, evidence,
   changes, related context, or case memory.
5. Close with persisted case memory and human-reviewed next checks.

Navigation is grouped into two presenter paths plus the platform view:

- **Operations** — **Investigation Workbench** (the hero path above).
- **Architecture** — **Catalog & Lineage** (dependency graph with a **System view
  / Data view** lens for order-to-cash operational lineage), then
  **Modernization** (change-planning impact). The Data view's "Plan a change to
  …" button opens Modernization with the entity's system of record selected.
- **Platform** — **Context Ingestion**: how raw CMDB, catalog, observability, and
  lineage exports become trusted context.
- **More…** — **Presenter Console** and **Classic Investigation** (legacy views).

---

## Architecture at a glance

```mermaid
flowchart LR
  sources[CMDB / Integration catalog / Observability / Runbooks]
  atlas[(MongoDB Atlas context layer)]
  capabilities[Atlas Search + Vector Search + Rerank + graphLookup]
  workbench[Investigation Workbench]
  caseMemory[(Auditable case memory)]
  human[Human-reviewed next checks]

  sources --> atlas
  atlas --> capabilities
  capabilities --> workbench
  workbench --> caseMemory
  workbench --> human
  caseMemory --> workbench
```

MongoDB is the context layer: flexible documents capture heterogeneous integration
metadata, typed relationships support graph traversal, Atlas Search and optional
Vector Search retrieve operational knowledge, and investigation cases preserve
auditable memory.

---

## Features

- **Search** across systems, interfaces, protocols, business terms, and owners —
  powered by **Atlas Search** (fuzzy + relevance-ranked), with a regex fallback.
- **Dependency graph** — traverse upstream/downstream relationships with
  `$graphLookup`, rendered as an interactive React Flow diagram.
- **Impact analysis** — simulate a failure and instantly see the failed
  interface, downstream systems at risk, responsible owner, runbook, and similar
  recent failures.
- **Modernization what-if** — "What breaks if we replace this system?" returns
  affected interfaces, owners to coordinate, and migration dependencies.
- **Agent v1 Investigation Workbench** — alert-first supervised workflow with
  topology mapping, related runbook/incident retrieval, evidence, likely
  fault-domain ranking, grounded follow-up, case memory, a grouped investigation
  playbook, alert deduplication/noise reduction, local alert lifecycle tracking,
  recent change correlation, a read-only ITSM handoff preview, local operator
  approval decisions, local case closure outcomes, a summary-first Presenter Mode,
  a guided enterprise context replay path, and collapsed secondary demo controls.
- **Operational lineage (order-to-cash)** — Catalog & Lineage's Data view traces
  data entities from hospital Purchase Order (X12 850) through canonical order,
  Apex ERP sales order, 855/856/810, and the 820 payment remittance. It shows
  transformations, system of record, producers/consumers, PO-number field
  mappings per hop, data owners vs interface owners, middleware "via" systems,
  and confirmed vs inferred lineage edges via `$graphLookup` over typed,
  tenant-scoped lineage relationships. Lineage also feeds **data impact**
  (which downstream documents are at risk when an interface fails, shown as a
  "Data affected" line in the Workbench summary) and **lineage-aware
  Modernization** (transformations, field mappings, and translation hops to
  rebuild when replacing a system).
- **Enterprise fixture ingestion** — optional Alertmanager, integration-catalog,
  CMDB-style, and change records are captured as raw source evidence, resolved
  to canonical keys, normalized into events/relationships, grouped into calm
  Workbench inbox items, correlated to investigations, and scored for trust.

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express + Mongoose (`backend/`) |
| Frontend | React + Vite + React Flow (`frontend/`) |
| Database | MongoDB Atlas Local (mongod + Atlas Search) via `docker-compose.yml` |

---

## Prerequisites

- Node.js 18+ and npm
- Docker (for the MongoDB Atlas Local container)

---

## Quick start

Copy the example config first, then pick a mode:

```bash
cp .env.example .env
```

### Option A — Local (Docker)

```bash
npm run demo
```

This starts MongoDB Atlas Local, installs dependencies, seeds the data, and
launches the backend (`:4000`) and frontend (`:5173`).

Then open **http://localhost:5173**.

- Stop servers: `Ctrl+C`
- Stop the database: `npm run stop`
- Re-seed the database: `npm run seed`

### Option B — MongoDB Atlas (cloud, no Docker)

Set `MONGO_URI` in `.env` to your Atlas SRV string (see
[Using MongoDB Atlas](#using-mongodb-atlas)), then:

```bash
npm run start:app
```

This installs dependencies, seeds the data, and launches backend + frontend —
**without** starting a local database container.

### Manual start

```bash
docker compose up -d            # local only — start MongoDB Atlas Local
cd backend && npm install && npm run seed && npm start
cd ../frontend && npm install && npm run dev
```

---

## Configuration

All configuration lives in a single **centralized `.env` at the repository root**.
Start from [`.env.example`](./.env.example), which documents both modes:

```
MONGO_URI=mongodb://localhost:27017/find_the_failure?directConnection=true
PORT=4000
ATLAS_RETRIEVAL_MODE=atlas-search
ENABLE_ATLAS_AUTO_EMBED_INDEX=false
```

It is loaded by `backend/src/config.js` (resolved relative to the module, so it
works regardless of the working directory). `directConnection=true` is required
because Atlas Local runs as a single-node replica set.

### Using MongoDB Atlas

To run against a cloud Atlas cluster instead of the local Docker container:

1. Create a cluster (the free **M0** tier works and includes Atlas Search).
2. Add a **database user** and allow your IP under **Network Access**.
3. Set `MONGO_URI` in `.env` to the cluster's SRV string, keeping the
   `/find_the_failure` database name and **omitting** `directConnection`:

   ```
   MONGO_URI=mongodb+srv://<USER>:<PASSWORD>@<cluster>.xxxxx.mongodb.net/find_the_failure?retryWrites=true&w=majority
   ```

4. Start without Docker: `npm run start:app`.

No code changes are needed — `ensureSearchIndexes()` creates the Atlas Search
indexes on your cluster on first startup. The `.env` is git-ignored, so
credentials stay out of version control; keep the URI in `.env` only (not in
shell commands, logs, or tickets).

### Related-context retrieval modes

The Investigation Workbench searches `operational_knowledge` for related
runbooks, incident notes, and business context. The default is Atlas Search with
a local keyword fallback.

- `ATLAS_RETRIEVAL_MODE=atlas-search` — default, no AI service required.
- `ATLAS_RETRIEVAL_MODE=atlas-rerank` — Atlas Search candidates + `$rerank`.
- `ATLAS_RETRIEVAL_MODE=vector-rerank` — Automated Embedding `$vectorSearch` + `$rerank`.
- `ATLAS_RETRIEVAL_MODE=auto` — try vector/rerank first, then fall back.

Set `ENABLE_ATLAS_AUTO_EMBED_INDEX=true` only on an Atlas project where
Automated Embedding and Native Reranking are enabled and expected. It creates a
`vectorSearch` index over `operational_knowledge.text` using the `autoEmbed`
field type.

---

## Data model (11 collections)

`systems`, `interfaces`, `data_entities`, `owners`, `events`,
`business_processes`, `relationships`, `source_records`, `operational_knowledge`,
`investigation_cases`, and `lineage_flows`.

`relationships` is the single canonical edge store: dependency traversal
(`/flow`, impact) and lineage traversal both read typed edges there with
`$graphLookup`; interface documents no longer embed `downstream_interfaces` or
lineage. Lineage flows are data: a `lineage_flows` document defines the business
identifier, entity ordering, and ordered interface path.

The `interfaces` collection uses a flexible schema so a single model can hold
EDI, REST, FHIR, event, and SFTP interfaces. Seeded footprint: **9 systems,
13 interfaces, 4 owners, 11 data entities, 3 business processes, 20 curated
dependency/process relationships, 5 source records, and 1 lineage flow**. Seed
also captures **14 raw lineage exports** as `source_records` (integration-catalog
lineage rows, a data-entity master, a trading-partner agreement, and a legacy
lineage workbook) and normalizes them through the ingestion pipeline into **51
order-to-cash lineage relationships** (`produces`, `carries`, `transforms_to`,
`consumes`, `system_of_record`) with provenance, source record ids, and an
ingestion run id. One edge is inferred from the legacy workbook to demonstrate
trust signals. The Context Ingestion tab and Workbench
can optionally load **11 enterprise fixture records** from Alertmanager,
integration-catalog, CMDB-style, and change exports, then normalize them into
additional relationship/event evidence with provenance. Three of those records are
raw external Alertmanager signals that collapse into two Workbench inbox items,
and three are recent changes that feed the Workbench "What changed?" panel. The Workbench can
also targeted-upsert **4 additional simulated observability alerts**, retrieve
**8 operational knowledge documents**, and persist investigation cases.

Operational agent collections now carry production-shaped `tenant_id` and
`environment` metadata with compound indexes for the Workbench hot paths:
alert inbox, deduplication, change correlation, related-context lookup, recent
events, relationship traversal, and case memory. Investigation cases also project
key fields such as interface, business process, dedupe group, confidence score,
related-context keys, and change keys at the top level while preserving the full
investigation snapshot. New investigations use those projections to retrieve
similar prior cases from case memory with match reasons and similarity scores.
Follow-up questions are answered by the backend from the persisted case snapshot
and saved with grounding labels, citations, and a MongoDB trace.

---

## API

Base URL: `http://localhost:4000/api`

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/search?q=` | Cross-collection Atlas Search (regex fallback) |
| GET | `/interfaces` · `/interfaces/:key` | List / full interface detail |
| GET | `/flow/:key` | Dependency graph (nodes + edges) |
| GET | `/impact/:key` | Downstream impact + owners + similar failures + lineage `data_impact` |
| GET | `/lineage/flows` · `/lineage/flows/:flowKey` | Lineage flow documents; ordered "follow the identifier" path |
| GET | `/lineage/entities?flow=` | Data entities for a flow (default `order-to-cash`) |
| GET | `/lineage/:entityKey?direction=&flow=` | Upstream/downstream operational lineage with transformations, mappings, and trust |
| POST | `/simulate/:key` | Inject a failure |
| POST | `/reset` | Restore pristine demo state |
| GET | `/scenarios` · POST `/scenarios/:id/run` | Named failure scenarios |
| GET | `/modernization/:systemKey` | What-if impact of replacing a system + `lineage_impact` |
| GET | `/ingestion` · GET `/ingestion/quality` | Source records, pipeline, quality, provenance score |
| POST | `/ingestion/fixtures` | Load optional enterprise fixture pack |
| POST | `/ingestion/run` | Normalize source records into relationships/events |
| POST | `/ingestion/fixtures/clear` | Remove optional fixture pack and normalized fixture evidence |
| GET | `/alerts` | List deduplicated alert inbox items with raw signal counts |
| POST | `/alerts/demo-feed` | Target-upsert simulated alert feed records |
| POST | `/alerts/:sourceRecordKey/lifecycle` | Update local Workbench alert lifecycle status |
| GET/POST | `/cases` · `/cases/investigate/:sourceRecordKey` | Persist and list investigation cases |
| POST | `/cases/:caseKey/messages` | Generate and persist backend-grounded follow-up Q&A |
| POST | `/cases/:caseKey/approval-decision` | Record a local approve/defer/reject handoff decision |
| POST | `/cases/:caseKey/outcome` | Record a local resolved/monitoring/transferred case outcome |
| POST | `/workbench/clear-demo-state` | Clear simulated feed alerts, lifecycle state, and case memory |
| GET | `/systems` · `/owners` | Listings |

---

## Project structure

```
Find_The_Failure/
├── .env                  # centralized config (git-ignored)
├── .env.example          # config template (local + Atlas)
├── docker-compose.yml    # MongoDB Atlas Local
├── package.json          # root scripts: demo, start:app, seed, stop
├── scripts/
│   ├── demo.sh           # local launcher (starts Docker DB)
│   └── app.sh            # Atlas launcher (no Docker)
├── DEMO.md               # presenter runbook
├── backend/
│   └── src/
│       ├── config.js     # loads root .env
│       ├── db.js         # Mongoose connection
│       ├── models.js     # 11 collections
│       ├── routes.js     # REST API
│       ├── server.js     # Express app
│       ├── scenarios.js  # named failure scenarios
│       ├── seed/         # seed data + runner
│       └── services/     # graph, impact, search, retrieval, search index
└── frontend/
    └── src/
        ├── api.js        # API client
        ├── App.jsx       # tab shell
        └── components/   # SearchBar, DependencyGraph, InterfaceDetails,
                          # Explorer, LineageView, Modernization
```

---

## Verifying the demo

```bash
npm run smoke
```

This full demo smoke test exercises the running server across search, graph,
impact, order-to-cash operational lineage, enterprise fixture ingestion,
quality/provenance scoring, scenarios,
modernization, Workbench investigation, alert deduplication, alert lifecycle,
change correlation, read-only ITSM handoff preview, local operator approval
decisions, local case closure outcomes, related context retrieval, similar-case
retrieval, backend-grounded follow-up Q&A, score breakdowns, projected case
memory fields, and reset/cleanup. It clears the
optional fixture pack before the Workbench path so the normal rehearsal baseline
remains stable.

For the smaller backend-only check, run `cd backend && node smoke.mjs`.
