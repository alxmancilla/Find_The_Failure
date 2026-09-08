export const businessProcesses = [
  {
    key: "hospital-order-fulfillment",
    name: "Hospital Order Fulfillment",
    description:
      "Critical order flow from hospital purchase order intake through ERP, inventory, order status, and notifications.",
    criticality: "tier-1",
    owner: "b2b-operations",
    data_entities: ["purchase-order", "inventory-request", "order-ack"],
    lifecycle: "production",
    sla: "Order accepted or rejected within 15 minutes",
  },
];