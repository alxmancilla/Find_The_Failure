export const lineageFlows = [
  {
    key: "order-to-cash",
    name: "Order to Cash",
    description: "Hospital purchase order through Apex ERP fulfillment, invoicing, remittance, and cash application.",
    domain: "order-to-cash",
    identifier: "po_number",
    identifier_label: "PO number",
    owner: "o2c-data-stewardship",
    entity_order: [
      "purchase-order", "canonical-order", "sales-order", "inventory-request", "order-status",
      "order-ack", "advance-ship-notice", "invoice", "payment-remittance", "cash-application",
    ],
    path: [
      "if-hospital-850", "if-gateway-x12", "if-x12-integration", "if-integration-erp",
      "if-erp-inventory", "if-erp-855", "if-erp-856", "if-erp-810", "if-hospital-820",
    ],
  },
  {
    key: "procure-to-pay",
    name: "Procure to Pay",
    description: "Inventory reorder through supplier purchase order, receipt, three-way match, and supplier payment.",
    domain: "procure-to-pay",
    identifier: "supplier_po_number",
    identifier_label: "supplier PO number",
    owner: "p2p-data-stewardship",
    entity_order: [
      "purchase-requisition", "supplier-purchase-order", "supplier-po-ack", "supplier-ship-notice",
      "goods-receipt", "inventory-lot", "supplier-invoice", "invoice-match", "supplier-payment",
    ],
    path: [
      "if-inventory-supplier", "if-supplier-855", "if-supplier-856", "if-receiving-erp",
      "if-supplier-810", "if-erp-820-supplier",
    ],
  },
];
