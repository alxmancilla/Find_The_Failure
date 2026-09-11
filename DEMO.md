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

## 2. Presenter talk track reference (≈6 minutes)

Open **Investigation Workbench**. Start from the alert inbox and let the agent
workflow populate the timeline, topology, evidence, and recommended checks.

### Act 1 — Start from the business symptom
1. Select the **ERP endpoint timeout** alert.
2. Say: "We are starting where operations starts: a rejected purchase order, not
   a static architecture diagram."
3. Click **Investigate selected alert**.

### Act 2 — Watch the agent investigation timeline
The agent activity timeline advances through:

- Alert received
- Mapped to interface
- Loaded topology
- Assessed impact
- Collected evidence
- Ranked fault domains
- Generated next checks

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
1. The likely fault domain is highlighted with confidence.
2. Show impacted business process, downstream risk, owners, and source evidence.
3. Review the safe next checks. No remediation is executed in Agent v1.

> "In seconds we know what broke, what's downstream, who owns it, and what
> business process is exposed."

### Act 5 — Ask grounded follow-up questions
Use the follow-up panel to ask:

- "Why is this the likely fault domain?"
- "What business process is impacted?"
- "Who owns this interface?"
- "What evidence supports this?"
- "What should I check first?"

> "This is the agent-ready moment: MongoDB provides the auditable context layer
> needed for grounded investigation and human-approved remediation."

### Act 6 — Show case memory and audit trail
After the investigation completes, point to **Case memory** in the Alert Inbox
and **Case timeline** in the right panel.

- Each investigation creates a persisted case record.
- The case stores the alert snapshot, summary, likely fault domain, evidence,
  recommended checks, timeline, and grounded follow-up Q&A.
- Selecting a saved case rehydrates the investigation context without rerunning
  the whole workflow.

> "The agent is not just answering in the moment. It is building an auditable
> investigation record that another operator can review later."

### Optional — Simulate more operational signals
1. In **Alert inbox**, click **Ingest latest alerts**.
2. Point out that this is a targeted observability feed ingest, not a demo reset.
3. Select a different alert such as **X12 translation backlog** or
   **Partner notification publish failures**.
4. Click **Investigate selected alert** to show that the topology, likely fault
   domain, evidence, and next checks change with the alert context.
5. Click **Clear feed + cases** when you want to reset the Workbench rehearsal
   state back to the original single-alert inbox and empty case memory.

### Optional — Manual workflow view
Go to **Demo Console** to manually step through topology reveal, failure
injection, metadata normalization, and alert investigation.

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
`business_processes`, `relationships`, `source_records`, and
`investigation_cases`.

Seeded footprint: **9 systems, 10 interfaces, 3 owners, 4 data entities**,
plus **2 business processes, 17 relationships, 5 source records, 3 failure
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
