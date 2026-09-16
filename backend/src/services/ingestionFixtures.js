export const ENTERPRISE_FIXTURE_GROUP = "enterprise-context-pack";

const now = () => new Date();
const minutesAgo = (m) => new Date(Date.now() - m * 60 * 1000);

const interfaceAliases = {
  ERP_ORDER_CREATE: "if-integration-erp",
  SUPPLIER_REPLENISH_850: "if-inventory-supplier",
  X12_TRANSLATION_QUEUE: "if-gateway-x12",
};

const systemAliases = {
  APEXERP01: "apex-erp",
  INV_SERVICE: "inventory-service",
  INTEGRATION_API: "integration-api",
  EDI_GATEWAY: "edi-gateway",
  X12_TRANSLATOR: "x12-translator",
  SUPPLIER_EDI: "supplier-edi",
};

const processNames = {
  "hospital-order-fulfillment": "Hospital Order Fulfillment",
  "supplier-replenishment": "Supplier Replenishment",
};

const alertmanagerFixtures = [
  {
    fingerprint: "amr-erp-order-create-timeout-001",
    labels: {
      alertname: "ApexERPOrderCreateLatencyHigh",
      severity: "critical",
      interface_alias: "ERP_ORDER_CREATE",
      service_alias: "APEXERP01",
      business_process: "hospital-order-fulfillment",
    },
    annotations: {
      summary: "Apex ERP order-create latency exceeded threshold",
      description: "p95 latency for order-create calls crossed 180s for three consecutive windows.",
      runbook_url: "https://runbooks.example-health.com/erp-endpoint",
    },
    startsAt: minutesAgo(14),
  },
  {
    fingerprint: "amr-supplier-ack-timeout-002",
    labels: {
      alertname: "SupplierEDITransportAckMissing",
      severity: "critical",
      status: "failed",
      interface_alias: "SUPPLIER_REPLENISH_850",
      service_alias: "SUPPLIER_EDI",
      business_process: "supplier-replenishment",
      message_type: "850",
    },
    annotations: {
      summary: "Supplier EDI acknowledgment timeout from external monitor",
      description: "Alertmanager received no supplier transport ACK for replenishment 850 within the 30-minute SLA.",
      runbook_url: "https://runbooks.example-health.com/supplier-edi-ack",
    },
    startsAt: minutesAgo(28),
  },
];

const integrationCatalogCsv = `external_id,interface_alias,source_alias,target_alias,relationship_type,target_key,owner_key,business_process_key,confidence,environment,evidence
INT-442,ERP_ORDER_CREATE,INTEGRATION_API,APEXERP01,routes_through,apex-erp,erp-integration,hospital-order-fulfillment,0.96,production,Integration catalog confirms order-create route into Apex ERP
INT-509,SUPPLIER_REPLENISH_850,INV_SERVICE,SUPPLIER_EDI,supports_process,supplier-replenishment,erp-integration,supplier-replenishment,0.88,production,Trading partner route maps supplier replenishment to outbound EDI 850
INT-288,X12_TRANSLATION_QUEUE,EDI_GATEWAY,X12_TRANSLATOR,routes_through,x12-translator,b2b-operations,hospital-order-fulfillment,0.94,production,Gateway route table confirms X12 translator handoff`;

const cmdbFixtures = [
  {
    sys_id: "APP-ERP-001",
    app_alias: "APEXERP01",
    owner_key: "erp-integration",
    business_process_key: "hospital-order-fulfillment",
    tier: "tier-1",
    last_certified_at: minutesAgo(90),
  },
  {
    sys_id: "APP-INV-014",
    app_alias: "INV_SERVICE",
    owner_key: "erp-integration",
    business_process_key: "supplier-replenishment",
    tier: "tier-1",
    last_certified_at: minutesAgo(120),
  },
];

const changeFixtures = [
  {
    change_id: "CHG-1842",
    source_system: "deployment-events",
    change_type: "deployment",
    asset_type: "system",
    asset_alias: "APEXERP01",
    business_process_key: "hospital-order-fulfillment",
    observed_at: minutesAgo(22),
    actor: "release-engineering",
    risk: "medium",
    summary: "Apex ERP order API patch deployed",
    detail: "Release 2026.09.16.3 updated order-create timeout handling and connection retry defaults.",
  },
  {
    change_id: "CHG-1847",
    source_system: "integration-catalog-export",
    change_type: "route",
    asset_type: "interface",
    interface_alias: "SUPPLIER_REPLENISH_850",
    business_process_key: "supplier-replenishment",
    observed_at: minutesAgo(34),
    actor: "b2b-operations",
    risk: "high",
    summary: "Supplier EDI route failover window changed",
    detail: "Catalog update moved replenishment 850 traffic to the supplier secondary transport profile.",
  },
  {
    change_id: "CHG-1815",
    source_system: "config-registry",
    change_type: "config",
    asset_type: "system",
    asset_alias: "X12_TRANSLATOR",
    business_process_key: "hospital-order-fulfillment",
    observed_at: minutesAgo(82),
    actor: "integration-platform",
    risk: "low",
    summary: "X12 translator batch-size config increased",
    detail: "Translator batch-size changed from 200 to 500 for inbound 850 processing throughput test.",
  },
];

export function buildEnterpriseFixtureSourceRecords(capturedAt = now()) {
  return [
    ...alertmanagerFixtures.map((fixture) => alertRecord(fixture, capturedAt)),
    ...parseCsv(integrationCatalogCsv).map((row) => integrationCatalogRecord(row, capturedAt)),
    ...cmdbFixtures.map((fixture) => cmdbRecord(fixture, capturedAt)),
    ...changeFixtures.map((fixture) => changeRecord(fixture, capturedAt)),
  ];
}

function alertRecord(fixture, capturedAt) {
  const alias = fixture.labels.interface_alias;
  const interfaceKey = interfaceAliases[alias];
  const processKey = fixture.labels.business_process;
  return sourceRecord({
    sourceSystem: "alertmanager-webhook",
    recordType: "alert",
    externalId: fixture.fingerprint,
    entityType: "interface",
    entityKey: interfaceKey,
    observedAt: fixture.startsAt,
    evidence: [fixture.annotations.description],
    resolution: resolution(alias, interfaceKey, "interface_alias"),
    payload: {
      status: fixture.labels.status || "degraded",
      severity: fixture.labels.severity,
      reason: fixture.annotations.summary,
      detail: fixture.annotations.description,
      message_type: fixture.labels.message_type || "order-create",
      business_process_key: processKey,
      business_process_name: processNames[processKey],
      raw: fixture,
    },
    capturedAt,
  });
}

function integrationCatalogRecord(row, capturedAt) {
  const interfaceKey = interfaceAliases[row.interface_alias];
  const toType = row.relationship_type === "supports_process" ? "business_process" : "system";
  const relationship = {
    key: `fixture:${row.external_id}:${interfaceKey}->${row.target_key}:${row.relationship_type}`,
    from_type: "interface",
    from_key: interfaceKey,
    to_type: toType,
    to_key: row.target_key,
    relationship_type: row.relationship_type,
    confidence: Number(row.confidence),
    confirmed: true,
    environment: row.environment,
    evidence: [row.evidence],
  };
  return sourceRecord({
    sourceSystem: "integration-catalog-export",
    recordType: "relationship",
    externalId: row.external_id,
    entityType: "interface",
    entityKey: interfaceKey,
    evidence: [row.evidence],
    resolution: resolution(row.interface_alias, interfaceKey, "interface_alias"),
    payload: { relationship, owner_key: row.owner_key, source_row: row },
    capturedAt,
  });
}

function cmdbRecord(fixture, capturedAt) {
  const systemKey = systemAliases[fixture.app_alias];
  const relationship = {
    key: `fixture:${fixture.sys_id}:${systemKey}->${fixture.business_process_key}:supports_process`,
    from_type: "system",
    from_key: systemKey,
    to_type: "business_process",
    to_key: fixture.business_process_key,
    relationship_type: "supports_process",
    confidence: 0.92,
    confirmed: true,
    environment: "production",
    evidence: [`CMDB ${fixture.sys_id} certifies ${systemKey} supports ${processNames[fixture.business_process_key]}.`],
  };
  return sourceRecord({
    sourceSystem: "servicenow-cmdb-export",
    recordType: "relationship",
    externalId: fixture.sys_id,
    entityType: "system",
    entityKey: systemKey,
    observedAt: fixture.last_certified_at,
    evidence: relationship.evidence,
    resolution: resolution(fixture.app_alias, systemKey, "cmdb_alias"),
    payload: { relationship, owner_key: fixture.owner_key, tier: fixture.tier, raw: fixture },
    capturedAt,
  });
}

function changeRecord(fixture, capturedAt) {
  const assetKey = fixture.asset_type === "interface"
    ? interfaceAliases[fixture.interface_alias]
    : systemAliases[fixture.asset_alias];
  const alias = fixture.interface_alias || fixture.asset_alias;
  return sourceRecord({
    sourceSystem: fixture.source_system,
    recordType: "change",
    externalId: fixture.change_id,
    entityType: fixture.asset_type,
    entityKey: assetKey,
    observedAt: fixture.observed_at,
    evidence: [`${fixture.change_id}: ${fixture.summary} — ${fixture.detail}`],
    resolution: resolution(alias, assetKey, fixture.asset_type === "interface" ? "interface_alias" : "cmdb_alias"),
    payload: {
      change_type: fixture.change_type,
      asset_type: fixture.asset_type,
      asset_key: assetKey,
      business_process_key: fixture.business_process_key,
      business_process_name: processNames[fixture.business_process_key],
      summary: fixture.summary,
      detail: fixture.detail,
      risk: fixture.risk,
      actor: fixture.actor,
      raw: fixture,
    },
    capturedAt,
  });
}

function sourceRecord({ sourceSystem, recordType, externalId, entityType, entityKey, observedAt, evidence, resolution, payload, capturedAt }) {
  return {
    key: `${ENTERPRISE_FIXTURE_GROUP}:${sourceSystem}:${externalId}`,
    fixture_group: ENTERPRISE_FIXTURE_GROUP,
    source_system: sourceSystem,
    record_type: recordType,
    external_id: externalId,
    entity_type: entityType,
    entity_key: entityKey,
    observed_at: observedAt || capturedAt,
    ingestion_status: "pending",
    evidence,
    entity_resolution: resolution,
    provenance: {
      source_system: sourceSystem,
      source_id: externalId,
      source_type: recordType,
      adapter: `${sourceSystem}-fixture-adapter`,
      captured_at: capturedAt,
      trust_level: sourceSystem.includes("cmdb") ? "certified" : "observed",
    },
    payload,
  };
}

function resolution(alias, canonicalKey, matchedBy) {
  return { alias, canonical_key: canonicalKey, status: canonicalKey ? "resolved" : "unresolved", confidence: canonicalKey ? 0.96 : 0, matched_by: matchedBy };
}

function parseCsv(csv) {
  const [headerLine, ...lines] = csv.trim().split("\n");
  const headers = headerLine.split(",");
  return lines.map((line) => Object.fromEntries(line.split(",").map((value, i) => [headers[i], value])));
}