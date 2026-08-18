# Find the Failure — Demo Runbook

**EDI Integration Impact Explorer.** A searchable, relationship-aware context
layer over the integration landscape. Answers *"What's affected, who owns it,
and what happens next?"* in seconds instead of hours.

> Key message: MongoDB does not replace McKesson's integration engines. It gives
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

## 2. Talk track (≈5 minutes)

### Act 1 — Search for an interface (the catalog)
1. In the search box, type **`Hospital 123`**.
2. Note the **⚡ Atlas Search** badge — results are fuzzy and relevance-ranked.
   - Try a typo: **`hosptial`** or **`mckessn`** still finds the right records.
3. Click **Hospital Order 850**.

> "One search spans systems, interfaces, protocols, business terms, and owners."

### Act 2 — Show the dependency path (relationships)
The graph renders the full flow:

```
Hospital 123 → EDI Gateway → X12 Translator → Integration API → McKesson ERP
      → Inventory Service / Order Status API / Customer Notifications
```

- **Click any node (system)** or **edge (interface)** to open the detail panel:
  name, description, protocol/type, source & target, owner + on-call + runbook,
  version, SLA, last successful transaction, business data, downstream impact.

> "This traversal is a single `$graphLookup` query over the metadata."

### Act 3 — Simulate a failure (impact analysis)
1. Click the red scenario button **"EDI 850 rejected — ERP timeout"**.
2. The screen updates instantly:
   - The failed interface turns **red**, downstream systems turn **orange**.
   - Panel shows: failed interface, affected order flow, downstream systems at
     risk, responsible owner + support contact + runbook, similar recent failures.
3. Optionally run **"X12 translation SLA breach"**.
4. Click **Reset** to return to a pristine state.

> "In seconds we know what broke, what's downstream, who owns it, and where the
> runbook is."

### Act 4 — Ask a modernization question (what-if)
1. Go to the **Modernization** tab.
2. Select **X12 Translator** → **Analyze**.
3. Returns affected interfaces (4), owners to coordinate (2), and downstream
   migration dependencies (4).

> "Before touching a component, see everything that depends on it."

---

## 3. MongoDB capabilities highlighted

| Capability | Where it shows up |
|---|---|
| Flexible documents | `interfaces` holds EDI, REST, FHIR, and event types in one collection |
| Atlas Search | Fuzzy, relevance-ranked search across all fields (⚡ badge) |
| Relationship traversal | `$graphLookup` builds the upstream/downstream dependency path |
| Event history alongside metadata | `events` power "similar recent failures" |
| Foundation for AI | Same model can later answer "What breaks if this API changes?" |

---

## 4. Data model (5 collections)

`systems`, `interfaces`, `data_entities`, `owners`, `events`.

Seeded footprint: **9 systems, 10 interfaces, 3 owners, 4 data entities**,
plus **2 failure scenarios** and **1 modernization scenario**.

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

---

## 6. Troubleshooting

- **Search shows no ⚡ badge / `engine: regex`** — the search index is still
  building; wait ~15s and retry. The app falls back to regex so it never breaks.
- **Port already in use** — a previous run is still up; `npm run stop` and re-run.
- **Reset the whole dataset** — `npm run seed`.
- **Verify the API** — `cd backend && node smoke.mjs` exercises every endpoint.
