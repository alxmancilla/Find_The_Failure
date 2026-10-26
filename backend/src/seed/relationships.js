import { interfaces } from "./interfaces.js";
import { DEFAULT_ENVIRONMENT, DEFAULT_TENANT_ID } from "../demoDefaults.js";

const now = new Date();

// Curated interface-to-interface dependencies; `relationships` is the only
// persisted dependency edge store.
const dependencyEdges = [
  ["if-hospital-850", "if-gateway-x12"],
  ["if-gateway-x12", "if-x12-integration"],
  ["if-x12-integration", "if-integration-erp"],
  ["if-integration-erp", "if-erp-inventory"],
  ["if-integration-erp", "if-erp-orderstatus"],
  ["if-integration-erp", "if-erp-notifications"],
  ["if-erp-inventory", "if-inventory-supplier"],
];
const coreOrderFlow = new Set([
  "if-hospital-850",
  "if-gateway-x12",
  "if-x12-integration",
  "if-integration-erp",
  "if-erp-inventory",
  "if-erp-orderstatus",
  "if-erp-notifications",
  "if-erp-855",
  "if-erp-856",
]);

const supplierReplenishmentFlow = new Set([
  "if-erp-inventory",
  "if-inventory-supplier",
]);

const invoicingCashFlow = new Set([
  "if-erp-810",
  "if-hospital-820",
]);

const rel = (r) => ({
  confidence: 1,
  confirmed: true,
  environment: DEFAULT_ENVIRONMENT,
  ...r,
});

const dependencyRows = dependencyEdges.map(([from, to]) =>
  rel({
    key: `${from}->${to}:depends_on`,
    from_type: "interface",
    from_key: from,
    to_type: "interface",
    to_key: to,
    relationship_type: "depends_on",
    evidence: [`Integration inventory lists ${to} as downstream of ${from}.`],
  })
);

const processRows = [
  ...interfaces
    .filter((iface) => coreOrderFlow.has(iface.key))
    .map((iface) =>
      rel({
        key: `${iface.key}->hospital-order-fulfillment:supports_process`,
        from_type: "interface",
        from_key: iface.key,
        to_type: "business_process",
        to_key: "hospital-order-fulfillment",
        relationship_type: "supports_process",
        evidence: [`${iface.name} participates in the hospital order fulfillment process.`],
      })
    ),
  ...interfaces
    .filter((iface) => supplierReplenishmentFlow.has(iface.key))
    .map((iface) =>
      rel({
        key: `${iface.key}->supplier-replenishment:supports_process`,
        from_type: "interface",
        from_key: iface.key,
        to_type: "business_process",
        to_key: "supplier-replenishment",
        relationship_type: "supports_process",
        evidence: [`${iface.name} participates in the supplier replenishment process.`],
      })
    ),
  ...interfaces
    .filter((iface) => invoicingCashFlow.has(iface.key))
    .map((iface) =>
      rel({
        key: `${iface.key}->hospital-invoicing-cash:supports_process`,
        from_type: "interface",
        from_key: iface.key,
        to_type: "business_process",
        to_key: "hospital-invoicing-cash",
        relationship_type: "supports_process",
        evidence: [`${iface.name} participates in the hospital invoicing and cash application process.`],
      })
    ),
];

// Curated inventory and process-map exports captured as raw source records;
// ingestion normalizes their rows into `relationships` with provenance.
export const INVENTORY_FIXTURE_GROUP = "integration-inventory-baseline";

const batchRecord = (sourceSystem, externalId, evidence, rows) => ({
  key: `${INVENTORY_FIXTURE_GROUP}:${sourceSystem}:${externalId}`,
  tenant_id: DEFAULT_TENANT_ID,
  environment: DEFAULT_ENVIRONMENT,
  fixture_group: INVENTORY_FIXTURE_GROUP,
  source_system: sourceSystem,
  record_type: "relationship",
  external_id: externalId,
  entity_type: "integration_inventory",
  entity_key: externalId,
  observed_at: now,
  ingestion_status: "pending",
  evidence,
  entity_resolution: { alias: externalId, canonical_key: externalId, status: "resolved", confidence: 1, matched_by: "canonical_key" },
  provenance: {
    source_system: sourceSystem,
    source_id: externalId,
    source_type: "relationship",
    adapter: `${sourceSystem}-adapter`,
    captured_at: now,
    trust_level: "certified",
  },
  payload: { kind: "relationship_batch", rows },
});

export const inventorySourceRecords = [
  batchRecord("integration-inventory-export", "INV-DEP-2026-10", ["Integration inventory export of interface-to-interface dependencies."], dependencyRows),
  batchRecord("process-map-export", "PRC-MAP-2026-10", ["Business process map export of interface-to-process support."], processRows),
];
