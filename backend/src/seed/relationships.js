import { interfaces } from "./interfaces.js";

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
  source_system: "seed-integration-inventory",
  environment: "production",
  first_seen_at: now,
  last_seen_at: now,
  evidence: ["Seeded from curated demo integration metadata."],
  ...r,
});

export const relationships = [
  ...dependencyEdges.map(([from, to]) =>
    rel({
      key: `${from}->${to}:depends_on`,
      from_type: "interface",
      from_key: from,
      to_type: "interface",
      to_key: to,
      relationship_type: "depends_on",
      source_record_id: `integration-inventory:${from}->${to}`,
      evidence: [`Integration inventory lists ${to} as downstream of ${from}.`],
    })
  ),
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
        source_record_id: `${iface.key}.business_process`,
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
        source_record_id: `${iface.key}.supplier_replenishment_process`,
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
        source_record_id: `${iface.key}.business_process`,
        evidence: [`${iface.name} participates in the hospital invoicing and cash application process.`],
      })
    ),
];
