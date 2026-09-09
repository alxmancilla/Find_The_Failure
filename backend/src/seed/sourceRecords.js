const now = new Date();
const daysAgo = (d) => new Date(now.getTime() - d * 24 * 3600 * 1000);
const hoursAgo = (h) => new Date(now.getTime() - h * 3600 * 1000);

const relationship = (source_system, external_id, rel, evidence, observed_at = daysAgo(1)) => ({
  key: `${source_system}:${external_id}`,
  source_system,
  record_type: "relationship",
  external_id,
  entity_type: rel.from_type,
  entity_key: rel.from_key,
  observed_at,
  ingestion_status: "pending",
  evidence,
  payload: { relationship: rel },
});

const alert = (external_id, entity_key, observed_at, evidence, payload) => ({
  key: `observability:${external_id}`,
  source_system: "observability-alerts",
  record_type: "alert",
  external_id,
  entity_type: "interface",
  entity_key,
  observed_at,
  ingestion_status: "pending",
  evidence,
  payload,
});

export const initialAlert = alert(
  "alert-erp-timeout-2026-09-08",
  "if-integration-erp",
  hoursAgo(1),
  ["APM alert detected elevated timeout rate on ERP order-create endpoint."],
  {
    status: "degraded",
    severity: "critical",
    reason: "ERP endpoint timeout spike",
    detail: "p95 timeout rate exceeded threshold for order-create calls.",
    message_type: "order-create",
  },
);

export const demoFeedAlerts = [
  alert(
    "alert-x12-translation-backlog-2026-09-08",
    "if-gateway-x12",
    hoursAgo(2),
    ["Gateway queue monitor detected delayed handoff from EDI Gateway to X12 Translator."],
    {
      status: "degraded",
      severity: "warning",
      reason: "X12 translation backlog",
      detail: "Inbound 850 translation queue depth exceeded threshold for 12 minutes.",
      message_type: "850",
    },
  ),
  alert(
    "alert-inventory-event-lag-2026-09-08",
    "if-erp-inventory",
    hoursAgo(3),
    ["Kafka lag monitor detected delayed inventory-updated events from Apex ERP."],
    {
      status: "degraded",
      severity: "warning",
      reason: "Inventory reservation event lag",
      detail: "Consumer lag exceeded threshold on inventory reservation updates.",
      message_type: "inventory-updated",
    },
  ),
  alert(
    "alert-partner-notification-failures-2026-09-08",
    "if-erp-notifications",
    hoursAgo(4),
    ["Event publisher reported elevated failures on partner confirmation notifications."],
    {
      status: "failed",
      severity: "critical",
      reason: "Partner notification publish failures",
      detail: "Publish error rate exceeded threshold for partner confirmation events.",
      message_type: "notification",
    },
  ),
];

export const demoAlerts = [initialAlert, ...demoFeedAlerts];

export const sourceRecords = [
  relationship(
    "edi-gateway-inventory",
    "route-850-gateway",
    {
      key: "if-hospital-850->edi-gateway:routes_through",
      from_type: "interface",
      from_key: "if-hospital-850",
      to_type: "system",
      to_key: "edi-gateway",
      relationship_type: "routes_through",
      confidence: 0.98,
      confirmed: true,
    },
    ["Gateway route table maps inbound 850 traffic to edi-gateway."],
  ),
  relationship(
    "integration-catalog",
    "route-x12-api",
    {
      key: "if-x12-integration->integration-api:routes_through",
      from_type: "interface",
      from_key: "if-x12-integration",
      to_type: "system",
      to_key: "integration-api",
      relationship_type: "routes_through",
      confidence: 0.95,
      confirmed: true,
    },
    ["Integration catalog route owner confirms X12 canonical orders use Integration API."],
  ),
  relationship(
    "cmdb-app-inventory",
    "erp-supports-order-fulfillment",
    {
      key: "apex-erp->hospital-order-fulfillment:supports_process",
      from_type: "system",
      from_key: "apex-erp",
      to_type: "business_process",
      to_key: "hospital-order-fulfillment",
      relationship_type: "supports_process",
      confidence: 0.9,
      confirmed: true,
    },
    ["CMDB business service mapping links Apex ERP to order fulfillment."],
  ),
  relationship(
    "cmdb-app-inventory",
    "stale-owner-map",
    {
      key: "if-inventory-supplier->hospital-order-fulfillment:supports_process:inferred",
      from_type: "interface",
      from_key: "if-inventory-supplier",
      to_type: "business_process",
      to_key: "hospital-order-fulfillment",
      relationship_type: "supports_process",
      confidence: 0.62,
      confirmed: false,
    },
    ["Inferred from old CMDB service map; requires SME confirmation."],
    daysAgo(76),
  ),
  initialAlert,
];