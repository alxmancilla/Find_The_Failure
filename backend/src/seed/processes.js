export const businessProcesses = [
  {
    key: "hospital-order-fulfillment",
    name: "Hospital Order Fulfillment",
    description:
      "Critical order flow from hospital purchase order intake through ERP, inventory, order status, and notifications.",
    criticality: "tier-1",
    owner: "b2b-operations",
    data_entities: ["purchase-order", "canonical-order", "sales-order", "inventory-request", "order-status", "order-ack", "advance-ship-notice"],
    lifecycle: "production",
    sla: "Order accepted or rejected within 15 minutes",
  },
  {
    key: "hospital-invoicing-cash",
    name: "Hospital Invoicing and Cash Application",
    description:
      "Order-to-cash billing flow from Apex ERP invoicing through hospital payment remittance and cash application.",
    criticality: "tier-2",
    owner: "erp-integration",
    data_entities: ["invoice", "payment-remittance"],
    lifecycle: "production",
    sla: "Invoice within 24 hours of shipment; apply cash within 1 business day",
  },
  {
    key: "supplier-replenishment",
    name: "Supplier Replenishment",
    description:
      "Inventory-driven replenishment flow from Apex ERP inventory updates through supplier EDI reorder transmission.",
    criticality: "tier-2",
    owner: "b2b-operations",
    data_entities: ["inventory-request", "purchase-order"],
    lifecycle: "production",
    sla: "Supplier replenishment order transmitted within 30 minutes of reorder trigger",
  },
];
