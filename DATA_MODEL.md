# Find the Failure — Data Model & Query Guide
This app uses MongoDB as a **context graph/catalog** and bounded case-memory
layer for integration metadata.

> An **interface** connects two systems. Systems, owners, business entities,
> events, alert source records, and investigation cases hang off it. Every
> graph edge — dependency, process support, and data lineage — is stored once,
> as a typed document in `relationships`. The app answers:
> **what is affected, who owns it, how does the data move, and what happened before?**

---

## Database and collections

- **Database:** `find_the_failure`
- **Collections (12):** `systems`, `interfaces`, `owners`, `data_entities`,
  `events`, `business_processes`, `relationships`, `source_records`,
  `operational_knowledge`, `investigation_cases`, `lineage_flows`,
  `message_events`

| Collection | Purpose | Example |
|---|---|---|
| `systems` | Applications, services, middleware | Hospital system, EDI gateway, ERP |
| `interfaces` | Integration flows between systems | EDI 850, REST API, Kafka event, FHIR API |
| `owners` | Support, architecture, and data owners | B2B Operations, Order-to-Cash Data Stewardship |
| `data_entities` | Business documents and records in motion | Purchase Order, Sales Order, Invoice |
| `events` | Operational history | ERP timeout, X12 SLA breach |
| `business_processes` | Business services supported by integrations | Order Fulfillment, Invoicing and Cash Application |
| `relationships` | The single store for typed graph edges, with evidence and confidence | depends_on, supports_process, transforms_to |
| `source_records` | Raw imported metadata, exports, and alerts | Inventory export, lineage catalog row, Alertmanager alert |
| `operational_knowledge` | Runbooks, incident notes, business context | ERP timeout triage note |
| `investigation_cases` | Persisted Agent v1 case memory | Timeline, evidence, follow-up Q&A |
| `lineage_flows` | Lineage flows defined as data | Order to Cash, Procure to Pay: identifier, entity order, path |
| `message_events` | Sample B2B tracking events keyed by business identifiers | PO-4500012388 failed at order-create; lot L-2291 shipped to 3 hospitals |

---

## Mental model

~~~text
systems               = graph nodes
interfaces            = integration flows between systems
relationships         = every edge (dependency, process, lineage), with provenance
owners                = accountability (interface support vs data ownership)
data_entities         = business meaning (what moves and who masters it)
source_records        = raw imported evidence; every relationship traces to one
events                = operational history per interface
message_events        = per-transaction tracking, keyed by business identifier
lineage_flows         = named flows: identifier, entity ordering, interface path
operational_knowledge = searchable runbooks and prior incidents
investigation_cases   = auditable investigation memory
~~~

Example dependency chain (`depends_on` edges):

~~~text
if-hospital-850
  -> if-gateway-x12
  -> if-x12-integration
  -> if-integration-erp
  -> if-erp-inventory / if-erp-orderstatus / if-erp-notifications
~~~

Example lineage path (`transforms_to` edges, order-to-cash):

~~~text
purchase-order -> canonical-order -> sales-order
  -> inventory-request / order-status / order-ack / advance-ship-notice / invoice
invoice -> payment-remittance -> cash-application
advance-ship-notice -> invoice   (inferred, legacy workbook, 60% confidence)
~~~

Example lineage path (`transforms_to` edges, procure-to-pay), with the
cross-flow edge used for recall traceability:

~~~text
purchase-requisition -> supplier-purchase-order
  -> supplier-po-ack / supplier-ship-notice / supplier-invoice
supplier-ship-notice -> goods-receipt -> invoice-match
supplier-invoice -> invoice-match -> supplier-payment   (three-way match)
goods-receipt -> inventory-lot -> advance-ship-notice   (recall; lot number reaches the customer 856)
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
- `last_status` — healthy, failed, degraded
- `business_impact` — business-language impact note

The `interfaces` schema uses `strict:false`, so different interface types can carry different metadata without changing the schema.

Interfaces do **not** embed graph edges. Downstream dependencies and lineage
(input/output entity, transformation, field mappings) live in `relationships`.

### `data_entities`

Business documents and records in motion. Key fields: `key`, `name`,
`business_terms` (searchable, e.g. "PO", "EDI 810"), `domain`
(`order-to-cash`, `procure-to-pay`), `entity_kind` (partner-document, transient-message,
system-record, event), `identifiers` (e.g. `po_number`), `system_of_record`,
and `data_owner` (distinct from interface owners).

### `events`

An event is recent operational history for an interface. Key fields:
`interface_key`, `timestamp`, `status`, `message_type`, `reason`, `detail`,
`severity`, `source_record_id`, and optional `provenance`.

### `business_processes`

A business process connects technical topology to business impact. Key fields:
`key`, `name`, `criticality`, `owner`, `data_entities`, `sla`.

### `relationships`

The single canonical edge store. Common fields: `key`, `tenant_id`,
`environment`, `from_type`, `from_key`, `to_type`, `to_key`,
`relationship_type`, `confidence`, `confirmed`, `evidence`, `source_system`,
`source_record_id`, `evidence_source_records`, `fixture_group`, and
`provenance` (including `ingestion_run_id`).

| Relationship type | From → to | Used for |
|---|---|---|
| `depends_on` | interface → interface | Dependency graph and failure impact |
| `supports_process` | interface/system → business_process | Business impact |
| `routes_through` | interface → system | Ingested route evidence |
| `transforms_to` | data_entity → data_entity | Lineage traversal |
| `carries` | interface → data_entity | The entity on the wire; canonical record of each lineage hop |
| `produces` / `consumes` | system → data_entity | Producers and consumers |
| `system_of_record` | data_entity → system | Authoritative system |

Lineage edges add `flow`, `interface_key`, `input_entity`, `output_entity`,
`transformed_by`, `transformation`, `field_mappings`, `mapping_version`,
`effective_from`, and `mapping_versions` (effective-dated history, e.g. X12
004010 → 005010). Data-steward decisions are stored as `review` and
`review_history`; they survive re-normalization, and rejected edges are excluded
from lineage traversal.

### `source_records`

Raw source metadata, kept unchanged and normalized into `relationships` and
`events` with provenance. Records carry `record_type`, `entity_type`,
`entity_key`, `payload`, `provenance`, `entity_resolution`, `fixture_group`,
`ingestion_status`, and `ingestion_run_id`.

| Group | Records | Normalized into |
|---|---|---|
| Seed baseline | 5 (4 relationship records + 1 alert) | Route/process edges, alert event |
| `integration-inventory-baseline` | 2 batch exports (inventory, process map) | 25 `depends_on` / `supports_process` edges |
| `o2c-lineage-catalog` | 14 lineage exports (11 catalog rows, entity master, partner agreement, legacy workbook) | 51 lineage edges |
| `p2p-lineage-catalog` | 8 lineage exports (6 catalog rows, entity master, lineage assertion) | 35 lineage edges |
| `recall-traceability` | 2 lineage exports (entity master, lineage assertion) + 1 recall notice (`record_type: "recall"`) | 5 lineage edges, including Inventory Lot → Advance Ship Notice |
| `enterprise-context-pack` (optional) | 11 Alertmanager, catalog, CMDB, and change records | Alerts, route/process edges, change correlation |

Alerts use `record_type: "alert"` and map to interfaces through `entity_key`.
Clearing the optional enterprise pack never removes inventory or lineage
records.

### `lineage_flows`

Flows as data. Key fields: `key`, `name`, `domain`, `identifier` (e.g.
`po_number`), `identifier_label`, `owner`, `entity_order`, and `path` (ordered
interface keys). Lineage services read ordering and paths from this document,
so a new flow needs data, not code. Two flows are seeded: `order-to-cash`
(identifier `po_number`, 9 hops) and `procure-to-pay` (identifier
`supplier_po_number`, 6 hops).

### `message_events`

Sample B2B tracking events for single-order and lot tracing. Key fields: `flow`,
`interface_key`, `message_id`, `business_keys` (e.g. `po_number`,
`supplier_po_number`, `invoice_number`, `receipt_number`, `shipment_id`,
`ship_to`, `lot_number`, `udi_device_identifier`, `quantity`), `status`,
`observed_at`, `latency_ms`, `detail`. Indexed on tenant, environment, flow, and
`business_keys.po_number` / `business_keys.supplier_po_number`, and on tenant,
environment, and `business_keys.lot_number` / `business_keys.udi_device_identifier`
for cross-flow lookups. Seeded: 44 events for 4 sample orders and 3 sample
supplier POs.

### `operational_knowledge`

Searchable operational memory for the Workbench. Key fields: `key`, `type`,
`title`, `text`, `interface_key`, `business_process_key`, `source_system`,
`tags`, and `observed_at`.

### `investigation_cases`

Persisted Agent v1 case memory. Each case stores an alert snapshot, investigation
summary, likely fault domain, evidence, recommended checks, timeline events, and
grounded follow-up Q&A.

---

## Main query patterns

| User action | API route | MongoDB operation |
|---|---|---|
| Search by typo/name/system/owner/business term | `/api/search?q=...` | Atlas Search `$search` on interfaces, systems, owners, processes, data entities; regex fallback |
| Open interface detail | `/api/interfaces/:key` | `findOne` + related `find` lookups |
| Show dependency graph | `/api/flow/:key` | `$graphLookup` over `depends_on` edges in `relationships` |
| Analyze impact | `/api/impact/:key` | `$graphLookup` + owner/system/event lookups + lineage `data_impact` |
| Trace data lineage | `/api/lineage/:entityKey?direction=&as_of=` | `$graphLookup` over scoped `transforms_to` edges, then hydrate producers/consumers/carriers |
| Follow the identifier | `/api/lineage/flows/:flowKey` | Read the `lineage_flows` path + `carries` edges per hop |
| Trace one order | `/api/lineage/flows/:flowKey/transactions/:value` | Business-key `find` on `message_events`, aligned to the flow path |
| Steward review | `/api/lineage/edges/:edgeKey/review` | `updateOne` with `$set: { review }` + `$push: { review_history }` |
| OpenLineage export | `/api/lineage/flows/:flowKey/openlineage` | Read `carries` edges; emit one RunEvent per hop |
| Identifier coverage | `/api/lineage/identifiers/:identifier/coverage?as_of=` | Read `carries` / `transforms_to` field mappings per flow hop, as of a date |
| Trace one identifier value | `/api/lineage/identifiers/:identifier/:value` | Business-key `find` on `message_events` across flows + `$group` by customer |
| Recall trace | `/api/recalls/:recallId?as_of=` | Recall `source_records` lookup + identifier trace + coverage |
| Simulate failure | `/api/simulate/:key` | update interface + insert failed event |
| Reset demo | `/api/reset` | `updateMany`, `deleteMany`, `insertMany` |
| Modernization impact | `/api/modernization/:systemKey` | `$or` over `source`, `target`, `middleware` + lineage the system performs, produces, or masters |
| Load enterprise fixtures | `/api/ingestion/fixtures` | `bulkWrite` raw fixture records into `source_records` |
| Normalize source records | `/api/ingestion/run` | Upsert `relationships` (including batch exports and lineage) and `events` with provenance |
| Clear enterprise fixtures | `/api/ingestion/fixtures/clear` | Delete fixture source records and derived fixture evidence |
| Ingest simulated alerts | `/api/alerts/demo-feed` | Targeted `bulkWrite` into `source_records` |
| Investigate alert | `/api/cases/investigate/:key` | Alert correlation + operational context retrieval + case insert |
| Clear rehearsal state | `/api/workbench/clear-demo-state` | Delete feed alerts + case memory only |

---

## How the important queries work

### Search

The app searches `interfaces`, `systems`, `owners`, `business_processes`, and `data_entities` with Atlas Search using fuzzy matching (`maxEdits: 2`) across indexed fields. If Atlas Search is not ready, or returns no hits while matching records exist, it falls back to case-insensitive regex search.

This lets a typo like `hosptial` still return **Hospital Order 850**, and `invoce` return the **Invoice** entity.

### Dependency graph

`/api/flow/:key` starts at an interface and uses `$graphLookup` over `relationships`, restricted to `depends_on` edges, then hydrates the reached interfaces. The backend returns React Flow data: `nodes` are systems and `edges` are interfaces.

### Impact analysis

`/api/impact/:key` starts with one interface, follows downstream `depends_on` edges, then resolves affected systems, owners, business processes, recent events, and similar failures. It also returns `data_impact`: which documents downstream of the failed hop's output can no longer be produced, derived from lineage. Data impact is additive and never changes the dependency-based result.

### Operational lineage

`/api/lineage/:entityKey` runs two `$graphLookup` stages (upstream and downstream) over `transforms_to` edges, scoped by tenant and environment and excluding rejected edges. It then loads `produces`, `consumes`, `carries`, and `system_of_record` context, and returns each hop's transformation, field mappings, owners, trust status, and source record. With `as_of`, it returns the mapping version effective on that date.

### Single-order trace

`/api/lineage/flows/:flowKey/transactions/:value` finds `message_events` by business identifier (for example `PO-4500012388`) and aligns them to the flow path. Hops after a failure are marked `blocked`, and the same data-impact traversal lists the documents not yet produced. A procure-to-pay hold (for example `SPO-7700468` at the three-way match) is reported as `on_hold`.

### Recall trace

`/api/recalls/:recallId` reads the recall notice from `source_records`, finds every `message_events` record carrying its `lot_number` across both flows, and groups them by customer (`ship_to`) to report receipts, shipments, on-hand quantity, and affected hospitals. Lot coverage reads the mapping effective on `as_of`, so receipts posted before the supplier 856 v2 mapping (for example `GR-51877`) are reported as untraceable by lot. Recommended actions are read-only.

### Agent v1 case memory

`/api/cases/investigate/:sourceRecordKey` runs deterministic alert correlation,
retrieves related runbooks/prior incidents from `operational_knowledge`, stores
an auditable investigation case, and preserves grounded follow-up Q&A.

Related-context retrieval defaults to Atlas Search and falls back to local keyword
scoring if Search is unavailable. On supported Atlas projects, the same stage can
be configured for Automated Embedding `$vectorSearch` and Native `$rerank`.

### Modernization analysis

`/api/modernization/:systemKey` finds all interfaces where the system appears as `source`, `target`, or `middleware`. This answers: **if we change this system, what integrations and owners are affected?** Its `lineage_impact` adds the transformations and field mappings the system performs, the entities it produces or masters, the downstream entities that depend on them, and the middleware translation hops to re-test.

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

### Data lineage and governance

- "Where does a Purchase Order come from, and what does it become?"
- "Which system is the system of record for the invoice, and who owns that data?"
- "If order-create fails, which documents can no longer be produced?"
- "Where is PO-4500012388 right now?"
- "What was the 850 mapping before the X12 005010 upgrade?"
- "Which lineage edges are inferred, and who confirmed or rejected them?"
- "Why is supplier PO SPO-7700468 not paid yet?"
- "Lot L-2291 is recalled — which hospitals received it, and how much is on hand?"
- "Which hops carry the lot number, and since when?"

---

## Validation and indexes

**Validators.** `relationships`, `message_events`, `source_records`, and
`lineage_flows` have `$jsonSchema` validators with `validationLevel: "moderate"`
and `validationAction: "warn"`. They require identity and scope fields
(`key`, `tenant_id`, `environment`, plus collection-specific keys), check types
(`confidence` 0–1, `confirmed` boolean, dates), and list known enums
(`relationship_type`, `from_type` / `to_type`, `record_type`, message `status`).
Unknown extra fields stay allowed. `backend/src/dbSetup.js` applies them on seed
and server start and logs the count of non-matching documents
(`$nor: [{ $jsonSchema }]`).

**Indexes.** Each secondary index serves a query shape the code runs;
`syncIndexes()` drops any index no longer declared in a schema.

| Collection | Index | Serves |
|---|---|---|
| `relationships` | `{from_key, relationship_type, tenant_id, environment}` and `{to_key, …}` | `$graphLookup` recursion (`connectToField`) and direct edge lookups |
| `source_records` | `{tenant_id, environment, record_type, observed_at}` (+ `payload.alert_group_key` / `source_system, entity_key` variants) | Alert inbox, deduplication, change correlation, recall notices |
| `investigation_cases` | `{tenant_id, environment, updatedAt}` and `{tenant_id, environment, <projected key>, updatedAt}` | Case list and similar-case retrieval |
| `events` | `{tenant_id, environment, interface_key, timestamp}` | Recent events and similar failures |
| `message_events` | `{tenant_id, environment, flow, business_keys.<id>, observed_at}` and lot / UDI variants | Order, supplier PO, and lot traces |

`interfaces` and `operational_knowledge` have no secondary B-tree indexes beyond
`key`: search and related-context retrieval use Atlas Search / Vector Search
indexes, created by `ensureSearchIndexes()`.

---

## Production caveats

The graph is only as correct as the ingested source records. Lineage is
ingested from curated exports, not discovered automatically, and the order
traces use seeded sample events. `$graphLookup` has a 100 MB per-stage memory limit and
does not spill to disk. Dynamic Atlas Search is great for the demo, but
production should tune paths, analyzers, boosts, synonyms, and index limits.
Failure simulation and rehearsal resets use separate writes; use transactions if
atomicity matters. The enterprise fixture pack demonstrates source contracts,
alias resolution, provenance, and quality findings, but a real PoC still needs
live connectors or governed file drops from CMDB, integration engines, APIs,
observability feeds, or knowledge systems, plus SME validation and access
controls.