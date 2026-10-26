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
];
