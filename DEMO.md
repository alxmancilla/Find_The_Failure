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

---

## 2. Guided talk track (≈6 minutes)

Open **Demo Console**. Use the left-side step rail and the green **Next** action
to keep the story moving.

### Act 1 — Start from the business symptom
1. Choose **EDI 850 rejected — ERP timeout**.
2. Say: "We are starting where operations starts: a rejected purchase order, not
   a static architecture diagram."
3. Click **Next: reveal topology**.

### Act 2 — Reveal the connected topology
The graph renders the order path:

```
Hospital 123 → EDI Gateway → X12 Translator → Integration API → Apex ERP
      → Inventory Service / Order Status API / Partner Notifications
```

- Click a node or edge to show live metadata in the side panel.
- Point out owner, SLA, business data, recent events, and downstream context.

> "MongoDB stores this as a flexible operational context graph, so we can move
> from a business symptom to technical dependencies without hand-built screens."

### Act 3 — Inject the failure and show impact
1. Click **Next: inject failure**.
2. The failed interface turns **red** and at-risk dependencies turn **orange**.
3. Show the side panel: impacted systems, business process context, owner, and
   similar recent failures.

> "In seconds we know what broke, what's downstream, who owns it, and what
> business process is exposed."

### Act 4 — Normalize enterprise metadata
1. Click **Next: normalize metadata**.
2. Explain that raw records from integration inventory, CMDB, and observability
   become normalized relationships/events with source evidence.
3. Show source-record, typed-edge, and data-quality counters.

> "The recommendation is grounded in existing enterprise data, not presenter
> notes or a hard-coded diagram."

### Act 5 — Investigate the alert
1. Click **Next: investigate alert**.
2. Show the grounded summary, likely fault domains, impacted process, evidence,
   and safe next actions.

> "This is the agent-ready moment: MongoDB provides the auditable context layer
> needed for grounded investigation and human-approved remediation."

### Optional — What-if modernization question
1. Go to the **Modernization** tab.
2. Select **X12 Translator** → **Analyze**.
3. Show affected interfaces, owners to coordinate, and downstream migration
   dependencies.

> "Before touching a component, see everything that depends on it."

---

## 3. MongoDB capabilities highlighted

| Capability | Where it shows up |
|---|---|
| Flexible documents | `interfaces` holds EDI, REST, FHIR, and event types in one collection |
| Atlas Search | Fuzzy, relevance-ranked search across all fields (⚡ badge) |
| Relationship traversal | `$graphLookup` builds the upstream/downstream dependency path |
| Federated ingestion | Raw inventory, CMDB, and observability records normalize into typed relationships |
| Evidence and provenance | Source records and relationship evidence support trusted investigation |
| Event history alongside metadata | `events` power "similar recent failures" |
| Foundation for AI | Same model can answer "what failed, who owns it, and what should we check next?" |

---

## 4. Data model

`systems`, `interfaces`, `data_entities`, `owners`, `events`,
`business_processes`, `relationships`, and `source_records`.

Seeded footprint: **9 systems, 10 interfaces, 3 owners, 4 data entities**,
plus **1 business process, 14 relationships, 5 source records, 2 failure
scenarios**, and **1 modernization scenario**.

---

## 5. Architecture

- **Backend** — Node + Express + Mongoose (`backend/`). REST API under `/api`.
- **Frontend** — React + Vite + React Flow (`frontend/`).
- **Database** — MongoDB Atlas Local (mongod + Atlas Search) via `docker-compose.yml`.

### Key endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/search?q=` | Cross-collection Atlas Search (regex fallback) |
| GET | `/api/interfaces/:key` | Full interface detail |
| GET | `/api/flow/:key` | Dependency graph (nodes + edges) |
| GET | `/api/impact/:key` | Downstream impact + owners + similar failures |
| POST | `/api/simulate/:key` | Inject a failure |
| POST | `/api/reset` | Restore pristine demo state |
| GET | `/api/scenarios` · POST `/api/scenarios/:id/run` | Named failure scenarios |
| GET | `/api/modernization/:systemKey` | What-if impact of replacing a system |
| GET/POST | `/api/ingestion` · `/api/ingestion/run` | Raw source records and normalization |
| GET | `/api/alerts` · `/api/investigation/:sourceRecordKey` | Read-only alert investigation |

---

## 6. Troubleshooting

- **Search shows no ⚡ badge / `engine: regex`** — the search index is still
  building; wait ~15s and retry. The app falls back to regex so it never breaks.
- **Port already in use** — a previous run is still up; `npm run stop` and re-run.
- **Reset the whole dataset** — `npm run seed`.
- **Verify the API** — `cd backend && node smoke.mjs` exercises every endpoint.
