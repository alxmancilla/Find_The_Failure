import { dataEntities } from "./base.js";
import { lineageRecord, lineageRow as row } from "./lineageCatalog.js";

// Procure-to-pay lineage exports. Same record shapes as order-to-cash, so the
// existing normalizer and lineage services handle them without code changes.
export const P2P_FIXTURE_GROUP = "p2p-lineage-catalog";
export const P2P_FLOW = "procure-to-pay";
export const RECALL_FIXTURE_GROUP = "recall-traceability";

const now = new Date();
const daysAgo = (d) => new Date(now.getTime() - d * 24 * 3600 * 1000);

const catalogRows = [
  row("P2P-850-01", "if-inventory-supplier", "purchase-requisition", "supplier-purchase-order", "inventory-service", "Reorder requisition becomes the outbound X12 850; Apex ERP holds the purchase order of record.", [
    ["supplier_po_number", "REPLENISHMENT_ORDER.PO_NO", "X12 850 BEG03"],
    ["item", "ITEM.SUPPLIER_PART_NO", "X12 850 PO107"],
    ["quantity", "REORDER.QTY", "X12 850 PO102"],
  ]),
  row("P2P-855-02", "if-supplier-855", "supplier-purchase-order", "supplier-po-ack", "meridian-medical", "Supplier acknowledges the purchase order as an X12 855.", [
    ["supplier_po_number", "X12 855 BAK03", "PO_ACK.PO_REF"],
    ["quantity", "X12 855 ACK02", "PO_ACK.CONFIRMED_QTY"],
  ]),
  row("P2P-856-03", "if-supplier-856", "supplier-purchase-order", "supplier-ship-notice", "meridian-medical", "Supplier ships against the purchase order and sends an X12 856 with lot details.", [
    ["supplier_po_number", "X12 856 PRF01", "ASN_IN.PO_REF"],
    ["quantity", "X12 856 SN102", "ASN_IN.SHIPPED_QTY"],
    ["lot_number", "X12 856 LIN/REF*LT", "ASN_IN.LOT_NO"],
  ], {
    version: "v2",
    standard: "X12 005010",
    effective_from: "2025-09-01",
    history: [{
      version: "v1",
      standard: "X12 004010",
      effective_from: "2023-01-01",
      effective_to: "2025-09-01",
      mappings: [
        ["supplier_po_number", "X12 856 PRF01", "ASN_IN.PO_REF"],
        ["quantity", "X12 856 SN102", "ASN_IN.SHIPPED_QTY"],
      ],
    }],
  }),
  row("P2P-GR-04", "if-receiving-erp", "supplier-ship-notice", "goods-receipt", "inventory-service", "Warehouse receiving matches the ship notice and posts a goods receipt to Apex ERP.", [
    ["supplier_po_number", "ASN_IN.PO_REF", "GOODS_RECEIPT.PO_REF"],
    ["receipt_number", "RECEIVING.RECEIPT_ID", "GOODS_RECEIPT.RECEIPT_NO"],
    ["lot_number", "ASN_IN.LOT_NO", "GOODS_RECEIPT.LOT_NO"],
    ["quantity", "RECEIVING.RECEIVED_QTY", "GOODS_RECEIPT.QTY"],
  ]),
  row("P2P-810-05", "if-supplier-810", "supplier-purchase-order", "supplier-invoice", "meridian-medical", "Supplier bills against the purchase order as an X12 810.", [
    ["supplier_po_number", "X12 810 BIG04", "AP_INVOICE.PO_REF"],
    ["supplier_invoice_number", "X12 810 BIG02", "AP_INVOICE.SUPPLIER_INV_NO"],
    ["amount", "X12 810 TDS01", "AP_INVOICE.GROSS_AMOUNT"],
  ]),
  row("P2P-820-06", "if-erp-820-supplier", "invoice-match", "supplier-payment", "apex-erp", "Matched invoices are paid and remittance advice is sent to the supplier as an X12 820.", [
    ["supplier_invoice_number", "AP_PAYMENT.INVOICE_REF", "X12 820 RMR02"],
    ["supplier_po_number", "AP_PAYMENT.PO_REF", "X12 820 REF*PO"],
    ["amount", "AP_PAYMENT.PAID_AMOUNT", "X12 820 RMR04"],
  ]),
];

const masterRows = (keys) => dataEntities
  .filter((e) => keys.includes(e.key))
  .map((e) => ({ entity_key: e.key, system_of_record: e.system_of_record, data_owner: e.data_owner }));

const p2p = (args) => lineageRecord({ group: P2P_FIXTURE_GROUP, flow: P2P_FLOW, ...args });
const recall = (args) => lineageRecord({ group: RECALL_FIXTURE_GROUP, flow: P2P_FLOW, ...args });

export const p2pLineageSourceRecords = [
  ...catalogRows.map(({ external_id, interface_key, ...lineage }) => p2p({
    sourceSystem: "integration-catalog-lineage-export",
    externalId: external_id,
    entityType: "interface",
    entityKey: interface_key,
    observedAt: daysAgo(2),
    evidence: [`Integration catalog lineage row ${external_id}: ${lineage.transformation}`],
    trust: "certified",
    payload: { kind: "interface_lineage", interface_key, ...lineage },
  })),
  p2p({
    sourceSystem: "data-entity-master-export",
    externalId: "DEM-P2P-2026-10",
    entityType: "data_entity",
    entityKey: P2P_FLOW,
    observedAt: daysAgo(5),
    evidence: ["Procure-to-pay data entity master lists the system of record for each entity."],
    trust: "certified",
    payload: { kind: "entity_master", rows: masterRows(dataEntities.filter((e) => e.domain === P2P_FLOW && e.key !== "inventory-lot").map((e) => e.key)) },
  }),
  p2p({
    sourceSystem: "ap-matching-rules",
    externalId: "AP-3WM-RULESET-4",
    entityType: "data_entity",
    entityKey: "invoice-match",
    observedAt: daysAgo(20),
    evidence: ["Accounts-payable rule set 4 matches PO, goods receipt, and supplier invoice within 2% price and 0% quantity tolerance."],
    trust: "certified",
    payload: {
      kind: "lineage_assertion",
      edges: [
        { from_type: "data_entity", from_key: "supplier-invoice", to_type: "data_entity", to_key: "invoice-match", relationship_type: "transforms_to", transformed_by: "apex-erp", transformation: "Supplier invoice is matched to the PO and goods receipt (three-way match)." },
        { from_type: "data_entity", from_key: "goods-receipt", to_type: "data_entity", to_key: "invoice-match", relationship_type: "transforms_to", transformed_by: "apex-erp", transformation: "Goods receipt quantities are the receipt leg of the three-way match." },
        { from_type: "system", from_key: "apex-erp", to_type: "data_entity", to_key: "invoice-match", relationship_type: "produces" },
      ],
    },
  }),
];

// Cross-flow lot traceability: supplier receipt -> inventory lot -> customer ship notice.
export const recallLineageSourceRecords = [
  recall({
    sourceSystem: "warehouse-lot-master",
    externalId: "LOT-MASTER-2026-10",
    entityType: "data_entity",
    entityKey: "inventory-lot",
    observedAt: daysAgo(3),
    evidence: ["Warehouse lot master links receipts to lots and lots to outbound shipment lines."],
    trust: "certified",
    payload: {
      kind: "lineage_assertion",
      edges: [
        { from_type: "data_entity", from_key: "goods-receipt", to_type: "data_entity", to_key: "inventory-lot", relationship_type: "transforms_to", transformed_by: "inventory-service", transformation: "Received quantity is put away as an inventory lot.", field_mappings: [{ field: "lot_number", source_path: "GOODS_RECEIPT.LOT_NO", target_path: "INVENTORY_LOT.LOT_NO" }] },
        { from_type: "data_entity", from_key: "inventory-lot", to_type: "data_entity", to_key: "advance-ship-notice", relationship_type: "transforms_to", interface_key: "if-erp-856", transformed_by: "apex-erp", transformation: "Picked lots are reported on customer ship notice lines.", field_mappings: [{ field: "lot_number", source_path: "INVENTORY_LOT.LOT_NO", target_path: "X12 856 LIN/REF*LT" }] },
        { from_type: "system", from_key: "inventory-service", to_type: "data_entity", to_key: "inventory-lot", relationship_type: "produces" },
      ],
    },
  }),
  recall({
    sourceSystem: "data-entity-master-export",
    externalId: "DEM-QUALITY-2026-10",
    entityType: "data_entity",
    entityKey: "quality",
    observedAt: daysAgo(5),
    evidence: ["Quality data entity master lists the system of record for lot and recall records."],
    trust: "certified",
    payload: { kind: "entity_master", rows: masterRows(["inventory-lot", "recall-notice"]) },
  }),
];
