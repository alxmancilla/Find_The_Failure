import { interfaces } from "./interfaces.js";

const now = new Date();
const coreOrderFlow = new Set([
  "if-hospital-850",
  "if-gateway-x12",
  "if-x12-integration",
  "if-integration-erp",
  "if-erp-inventory",
  "if-erp-orderstatus",
  "if-erp-notifications",
  "if-erp-855",
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
  ...interfaces.flatMap((iface) =>
    (iface.downstream_interfaces || []).map((to) =>
      rel({
        key: `${iface.key}->${to}:depends_on`,
        from_type: "interface",
        from_key: iface.key,
        to_type: "interface",
        to_key: to,
        relationship_type: "depends_on",
        source_record_id: `${iface.key}.downstream_interfaces`,
        evidence: [`${iface.key} lists ${to} as a downstream interface.`],
      })
    )
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
];