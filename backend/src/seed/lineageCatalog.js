import { DEFAULT_ENVIRONMENT, DEFAULT_TENANT_ID } from "../demoDefaults.js";
import { dataEntities } from "./base.js";

// Raw lineage exports captured as source_records. The ingestion normalizer
// derives typed lineage relationships from these records.
export const LINEAGE_FIXTURE_GROUP = "o2c-lineage-catalog";
export const LINEAGE_FLOW = "order-to-cash";

const now = new Date();
const daysAgo = (d) => new Date(now.getTime() - d * 24 * 3600 * 1000);

const toMappings = (mappings) => mappings.map(([field, source_path, target_path]) => ({ field, source_path, target_path }));

// Each row carries effective-dated mapping versions; the latest is current.
const row = (external_id, interface_key, input_entity, output_entity, transformed_by, transformation, mappings, { version = "v1", standard = null, effective_from = "2024-01-01", history = [] } = {}) => ({
  external_id,
  interface_key,
  input_entity,
  output_entity,
  transformed_by,
  transformation,
  mapping_version: version,
  effective_from: new Date(effective_from),
  field_mappings: toMappings(mappings),
  mapping_versions: [
    ...history.map((h) => ({ version: h.version, standard: h.standard || null, effective_from: new Date(h.effective_from), effective_to: new Date(h.effective_to), field_mappings: toMappings(h.mappings) })),
    { version, standard, effective_from: new Date(effective_from), effective_to: null, field_mappings: toMappings(mappings) },
  ],
});

const catalogRows = [
  row("LIN-850-01", "if-hospital-850", "purchase-order", "purchase-order", "hospital-123", "Hospital submits the purchase order as an X12 850 envelope.", [
    ["po_number", "Hospital requisition PO number", "X12 850 BEG03"],
    ["order_line", "Hospital requisition lines", "X12 850 PO1 loop"],
  ]),
  row("LIN-850-02", "if-gateway-x12", "purchase-order", "canonical-order", "x12-translator", "X12 850 segments are parsed and mapped to the canonical order JSON.", [
    ["po_number", "X12 850 BEG03", "canonical.order.poNumber"],
    ["order_line", "X12 850 PO1 loop", "canonical.order.lines[]"],
    ["quantity", "X12 850 PO102", "canonical.order.lines[].quantity"],
  ], {
    version: "v3",
    standard: "X12 005010",
    effective_from: "2026-03-01",
    history: [{
      version: "v2",
      standard: "X12 004010",
      effective_from: "2024-01-01",
      effective_to: "2026-03-01",
      mappings: [
        ["po_number", "X12 850 BEG03", "canonical.order.po"],
        ["order_line", "X12 850 PO1 loop", "canonical.order.items[]"],
        ["quantity", "X12 850 PO102", "canonical.order.items[].qty"],
      ],
    }],
  }),
  row("LIN-ORD-03", "if-x12-integration", "canonical-order", "canonical-order", "x12-translator", "Canonical order is routed to the Integration API without changing shape.", [
    ["po_number", "canonical.order.poNumber", "POST /orders body.poNumber"],
    ["order_line", "canonical.order.lines[]", "POST /orders body.lines[]"],
  ]),
  row("LIN-ORD-04", "if-integration-erp", "canonical-order", "sales-order", "apex-erp", "Order-create maps the canonical order to an Apex ERP sales order of record.", [
    ["po_number", "body.poNumber", "SALES_ORDER.CUSTOMER_PO_REF"],
    ["order_line", "body.lines[]", "SALES_ORDER_LINE"],
    ["quantity", "body.lines[].quantity", "SALES_ORDER_LINE.ORDER_QTY"],
  ], {
    version: "v2",
    effective_from: "2025-06-01",
    history: [{
      version: "v1",
      effective_from: "2023-07-01",
      effective_to: "2025-06-01",
      mappings: [
        ["po_number", "body.po", "SALES_ORDER.CUST_REF"],
        ["order_line", "body.items[]", "SALES_ORDER_LINE"],
        ["quantity", "body.items[].qty", "SALES_ORDER_LINE.QTY"],
      ],
    }],
  }),
  row("LIN-INV-05", "if-erp-inventory", "sales-order", "inventory-request", "apex-erp", "Sales order lines publish stock reservation events.", [
    ["po_number", "SALES_ORDER.CUSTOMER_PO_REF", "inventory.reserved.poReference"],
    ["quantity", "SALES_ORDER_LINE.ORDER_QTY", "inventory.reserved.quantity"],
  ]),
  row("LIN-STS-06", "if-erp-orderstatus", "sales-order", "order-status", "apex-erp", "Sales order lifecycle changes are published as order status.", [
    ["po_number", "SALES_ORDER.CUSTOMER_PO_REF", "status.poNumber"],
  ]),
  row("LIN-STS-07", "if-erp-notifications", "order-status", "order-status", "apex-erp", "Order status changes trigger partner confirmations and exception notices.", [
    ["po_number", "status.poNumber", "notification.poNumber"],
  ]),
  row("LIN-855-08", "if-erp-855", "sales-order", "order-ack", "apex-erp", "Accepted sales order is acknowledged to the hospital as an X12 855.", [
    ["po_number", "SALES_ORDER.CUSTOMER_PO_REF", "X12 855 BAK03"],
    ["order_line", "SALES_ORDER_LINE", "X12 855 PO1/ACK loop"],
  ]),
  row("LIN-856-09", "if-erp-856", "sales-order", "advance-ship-notice", "apex-erp", "Shipped sales order lines become an X12 856 ship notice.", [
    ["po_number", "SALES_ORDER.CUSTOMER_PO_REF", "X12 856 PRF01"],
    ["quantity", "DELIVERY_LINE.SHIPPED_QTY", "X12 856 SN102"],
  ]),
  row("LIN-810-10", "if-erp-810", "sales-order", "invoice", "apex-erp", "Billed sales order becomes an X12 810 invoice.", [
    ["po_number", "SALES_ORDER.CUSTOMER_PO_REF", "X12 810 BIG04"],
    ["invoice_number", "BILLING_DOC.INVOICE_NO", "X12 810 BIG02"],
    ["amount", "BILLING_DOC.NET_AMOUNT", "X12 810 TDS01"],
  ]),
  row("LIN-820-11", "if-hospital-820", "payment-remittance", "cash-application", "apex-erp", "Inbound X12 820 remittance is applied to open invoices in Apex ERP cash application.", [
    ["invoice_number", "X12 820 RMR02", "CASH_APPLICATION.INVOICE_REF"],
    ["po_number", "X12 820 REF*PO", "CASH_APPLICATION.CUSTOMER_PO_REF"],
    ["amount", "X12 820 RMR04", "CASH_APPLICATION.PAID_AMOUNT"],
  ]),
];

const record = ({ sourceSystem, externalId, entityType, entityKey, observedAt, evidence, trust, payload }) => ({
  key: `${LINEAGE_FIXTURE_GROUP}:${sourceSystem}:${externalId}`,
  tenant_id: DEFAULT_TENANT_ID,
  environment: DEFAULT_ENVIRONMENT,
  fixture_group: LINEAGE_FIXTURE_GROUP,
  source_system: sourceSystem,
  record_type: "lineage",
  external_id: externalId,
  entity_type: entityType,
  entity_key: entityKey,
  observed_at: observedAt,
  ingestion_status: "pending",
  evidence,
  entity_resolution: { alias: entityKey, canonical_key: entityKey, status: "resolved", confidence: 1, matched_by: "canonical_key" },
  provenance: {
    source_system: sourceSystem,
    source_id: externalId,
    source_type: "lineage",
    adapter: `${sourceSystem}-adapter`,
    captured_at: now,
    trust_level: trust,
  },
  payload: { flow: LINEAGE_FLOW, ...payload },
});

export const lineageSourceRecords = [
  ...catalogRows.map(({ external_id, interface_key, ...lineage }) => record({
    sourceSystem: "integration-catalog-lineage-export",
    externalId: external_id,
    entityType: "interface",
    entityKey: interface_key,
    observedAt: daysAgo(2),
    evidence: [`Integration catalog lineage row ${external_id}: ${lineage.transformation}`],
    trust: "certified",
    payload: { kind: "interface_lineage", interface_key, ...lineage },
  })),
  record({
    sourceSystem: "data-entity-master-export",
    externalId: "DEM-O2C-2026-10",
    entityType: "data_entity",
    entityKey: LINEAGE_FLOW,
    observedAt: daysAgo(5),
    evidence: ["Order-to-cash data entity master lists the system of record for each entity."],
    trust: "certified",
    payload: {
      kind: "entity_master",
      rows: dataEntities
        .filter((e) => e.domain === LINEAGE_FLOW && e.system_of_record)
        .map((e) => ({ entity_key: e.key, system_of_record: e.system_of_record, data_owner: e.data_owner })),
    },
  }),
  record({
    sourceSystem: "trading-partner-agreement",
    externalId: "TPA-HOSP123-820",
    entityType: "data_entity",
    entityKey: "payment-remittance",
    observedAt: daysAgo(30),
    evidence: ["Trading partner agreement requires 820 remittance to reference 810 invoice numbers (RMR02)."],
    trust: "contractual",
    payload: {
      kind: "lineage_assertion",
      confidence: 0.9,
      confirmed: true,
      edges: [
        { from_type: "data_entity", from_key: "invoice", to_type: "data_entity", to_key: "payment-remittance", relationship_type: "transforms_to", transformed_by: "hospital-123", transformation: "Hospital accounts payable pays the invoice and issues remittance advice referencing invoice numbers." },
        { from_type: "system", from_key: "hospital-123", to_type: "data_entity", to_key: "payment-remittance", relationship_type: "produces" },
      ],
    },
  }),
  record({
    sourceSystem: "legacy-lineage-workbook",
    externalId: "O2C-ROW-17",
    entityType: "data_entity",
    entityKey: "invoice",
    observedAt: daysAgo(210),
    evidence: ["Legacy lineage workbook row O2C-ROW-17 links ASN quantities to invoice lines; requires SME confirmation."],
    trust: "inferred",
    payload: {
      kind: "lineage_assertion",
      confidence: 0.6,
      confirmed: false,
      edges: [
        { from_type: "data_entity", from_key: "advance-ship-notice", to_type: "data_entity", to_key: "invoice", relationship_type: "transforms_to", transformed_by: "apex-erp", transformation: "Invoice quantities appear to be billed as shipped from the ship notice." },
      ],
    },
  }),
];
