# Find the Failure — Data Model & Query Guide
This app uses MongoDB as a **context graph/catalog** and bounded case-memory
layer for integration metadata.

> An **interface** is modeled as an edge between systems. Systems, owners,
> business entities, events, alert source records, and investigation cases hang
> off that edge. The app answers:
> **what is affected, who owns it, and what happened before?**

---

## Database and collections

- **Database:** `find_the_failure`
- **Collections:** `systems`, `interfaces`, `owners`, `data_entities`, `events`,
  `business_processes`, `relationships`, `source_records`, `investigation_cases`

| Collection | Purpose | Example |
|---|---|---|
| `systems` | Applications, services, middleware | Hospital system, EDI gateway, ERP |
| `interfaces` | Integration flows; the graph edges | EDI 850, REST API, Kafka event, FHIR API |
| `owners` | Support / architecture owners | B2B Operations, ERP Integration |
| `data_entities` | Business objects in motion | Purchase order, inventory request |
| `events` | Operational history | ERP timeout, X12 SLA breach |
| `business_processes` | Business services supported by integrations | Order Fulfillment, Supplier Replenishment |
| `relationships` | Typed graph edges with evidence/confidence | depends_on, supports_process |
| `source_records` | Raw imported metadata and alerts | CMDB row, observability alert |
| `investigation_cases` | Persisted Agent v1 case memory | Timeline, evidence, follow-up Q&A |

---

## Mental model

~~~text
systems       = graph nodes
interfaces    = graph edges
owners        = accountability
data_entities = business meaning
events        = operational history
source_records = raw imported evidence
relationships = canonical evidence-backed edges
investigation_cases = auditable investigation memory
~~~

Example edge: `hospital-123 --if-hospital-850--> edi-gateway`

Example chain:

~~~text
if-hospital-850
  -> if-gateway-x12
  -> if-x12-integration
  -> if-integration-erp
  -> if-erp-inventory / if-erp-orderstatus / if-erp-notifications
~~~

---

## Core document shapes

### `systems`

A system is a node in the estate. Key fields: `key`, `name`, `kind`, `vendor`, `owner`.

### `interfaces`

An interface is the core graph edge. Key fields:

- `key`, `name`, `description`
- `type` — EDI, REST, FHIR, EVENT, SFTP
- `protocol` — X12, HTTPS, HL7-FHIR, Kafka, SFTP
- `message_type` — 850, 855, Patient, order-create, etc.
- `source` / `target` — system keys
- `middleware` — middleware system keys
- `owners` — owner keys
- `data_entities` — business entity keys
- `downstream_systems` — affected systems
- `downstream_interfaces` — interface keys used by `$graphLookup`
- `last_status` — healthy, failed, degraded
- `business_impact` — business-language impact note

The `interfaces` schema uses `strict:false`, so different interface types can carry different metadata without changing the schema.

### `events`

An event is recent operational history for an interface. Key fields: `interface_key`, `timestamp`, `status`, `message_type`, `reason`, `detail`, `severity`.

### `business_processes`

A business process connects technical topology to business impact. Key fields:
`key`, `name`, `criticality`, `owner`, `data_entities`, `sla`.

### `relationships`

Canonical typed edges with provenance. Key fields: `from_type`, `from_key`,
`to_type`, `to_key`, `relationship_type`, `confidence`, `confirmed`, `evidence`,
`source_system`, and `source_record_id`.

### `source_records`

Raw or normalized source metadata from inventory, CMDB/app ownership, and
observability feeds. Alerts are represented as `record_type: "alert"` and map to
interfaces through `entity_key`.

### `investigation_cases`

Persisted Agent v1 case memory. Each case stores an alert snapshot, investigation
summary, likely fault domain, evidence, recommended checks, timeline events, and
grounded follow-up Q&A.

---

## Main query patterns

| User action | API route | MongoDB operation |
|---|---|---|
| Search by typo/name/system/owner | `/api/search?q=...` | Atlas Search `$search`; regex fallback |
| Open interface detail | `/api/interfaces/:key` | `findOne` + related `find` lookups |
| Show dependency graph | `/api/flow/:key` | `$graphLookup` over `interfaces` |
| Analyze impact | `/api/impact/:key` | `$graphLookup` + owner/system/event lookups |
| Simulate failure | `/api/simulate/:key` | update interface + insert failed event |
| Reset demo | `/api/reset` | `updateMany`, `deleteMany`, `insertMany` |
| Modernization impact | `/api/modernization/:systemKey` | `$or` over `source`, `target`, `middleware` |
| Ingest simulated alerts | `/api/alerts/demo-feed` | Targeted `bulkWrite` into `source_records` |
| Investigate alert | `/api/cases/investigate/:key` | Alert correlation + persisted case insert |
| Clear rehearsal state | `/api/workbench/clear-demo-state` | Delete feed alerts + case memory only |

---

## How the important queries work

### Search

The app searches `interfaces`, `systems`, and `owners` with Atlas Search using fuzzy matching (`maxEdits: 2`) across indexed fields. If Atlas Search is not ready, it falls back to case-insensitive regex search.

This lets a typo like `hosptial` still return **Hospital Order 850**.

### Dependency graph

`/api/flow/:key` uses `$graphLookup` to recursively follow `downstream_interfaces` where each next interface's `key` matches. The backend returns React Flow data: `nodes` are systems and `edges` are interfaces.

### Impact analysis

`/api/impact/:key` starts with one interface, follows downstream interfaces, then resolves affected systems, owners, recent events, and similar failures. This is the core blast-radius answer.

### Agent v1 case memory

`/api/cases/investigate/:sourceRecordKey` runs deterministic alert correlation,
stores an auditable investigation case, and preserves grounded follow-up Q&A. This
is intentionally read-only and bounded; LLM/tool orchestration is a future phase.

### Modernization analysis

`/api/modernization/:systemKey` finds all interfaces where the system appears as `source`, `target`, or `middleware`. This answers: **if we change this system, what integrations and owners are affected?**

---

## Example questions this app can answer

### Incident response

- "Hospital orders are failing — what systems are downstream?"
- "Who owns the failed EDI 850 order flow?"
- "If `if-integration-erp` fails, which systems and interfaces are affected?"
- "Has this ERP timeout happened before?"
- "What recent events exist for this interface?"

### Dependency discovery

- "Show the path from the hospital order feed to the ERP."
- "What interface comes after the EDI gateway?"
- "Which systems sit between Hospital 123 and Apex ERP?"
- "What depends on the X12 translator?"

### Ownership, search, modernization, and change planning

- "Who should be paged for this failed interface?"
- "Find the hospital order interface even if I type `hosptial`."
- "Find interfaces related to purchase orders, X12, or ERP."
- "If we replace the X12 translator, what breaks?"
- "Which interfaces touch Apex ERP?"
- "Which interfaces should be regression-tested before an ERP upgrade?"

---

## Production caveats

The graph is only as correct as the provided relationships and
`downstream_interfaces`. `$graphLookup` has a 100 MB per-stage memory limit and
does not spill to disk. Dynamic Atlas Search is great for the demo, but
production should tune paths, analyzers, boosts, synonyms, and index limits.
Failure simulation and rehearsal resets use separate writes; use transactions if
atomicity matters. A real PoC also needs ingestion from CMDB, integration
engines, APIs, observability feeds, or files, plus SME validation and access
controls.