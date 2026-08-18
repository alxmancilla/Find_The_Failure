// Owners, systems, and data entities for the "Find the Failure" demo.

export const owners = [
  {
    key: "b2b-operations",
    name: "B2B Operations",
    team: "B2B Integration Operations",
    email: "b2b-ops@example-health.com",
    slack: "#b2b-operations",
    on_call: "PagerDuty: b2b-ops-primary",
    runbook_url: "https://runbooks.example-health.com/edi-850-timeout",
  },
  {
    key: "erp-integration",
    name: "ERP Integration Team",
    team: "McKesson ERP Integration",
    email: "erp-integration@example-health.com",
    slack: "#erp-integration",
    on_call: "PagerDuty: erp-primary",
    runbook_url: "https://runbooks.example-health.com/erp-endpoint",
  },
  {
    key: "hospital-systems",
    name: "Hospital Systems Team",
    team: "Hospital Clinical Systems",
    email: "hospital-systems@example-health.com",
    slack: "#hospital-systems",
    on_call: "PagerDuty: hospital-primary",
    runbook_url: "https://runbooks.example-health.com/hospital-onboarding",
  },
];

export const systems = [
  {
    key: "hospital-123",
    name: "Hospital 123",
    kind: "source",
    description: "Regional hospital submitting purchase orders and clinical data.",
    vendor: "Epic",
    owner: "hospital-systems",
  },
  {
    key: "edi-gateway",
    name: "EDI Gateway",
    kind: "middleware",
    description: "Entry point that receives inbound EDI envelopes from trading partners.",
    vendor: "IBM Sterling",
    owner: "b2b-operations",
  },
  {
    key: "x12-translator",
    name: "X12 Translator",
    kind: "translator",
    description: "Translates ANSI X12 documents to canonical internal formats.",
    vendor: "IBM Sterling",
    owner: "b2b-operations",
  },
  {
    key: "integration-api",
    name: "Integration API",
    kind: "api",
    description: "Internal REST integration layer routing messages to backend systems.",
    vendor: "In-house",
    owner: "erp-integration",
  },
  {
    key: "mckesson-erp",
    name: "McKesson ERP",
    kind: "target",
    description: "Core ERP handling procurement, inventory, and order management.",
    vendor: "McKesson",
    owner: "erp-integration",
  },
  {
    key: "inventory-service",
    name: "Inventory Service",
    kind: "service",
    description: "Tracks stock levels and triggers replenishment.",
    vendor: "In-house",
    owner: "erp-integration",
  },
  {
    key: "order-status-api",
    name: "Order Status API",
    kind: "service",
    description: "Exposes order lifecycle status to partners and portals.",
    vendor: "In-house",
    owner: "erp-integration",
  },
  {
    key: "customer-notifications",
    name: "Customer Notifications",
    kind: "service",
    description: "Sends order confirmations and exception alerts to customers.",
    vendor: "In-house",
    owner: "erp-integration",
  },
  {
    key: "supplier-edi",
    name: "Supplier EDI",
    kind: "target",
    description: "Outbound EDI channel for supplier replenishment orders.",
    vendor: "IBM Sterling",
    owner: "b2b-operations",
  },
];

export const dataEntities = [
  {
    key: "purchase-order",
    name: "Purchase Order",
    description: "Order for medical supplies submitted by a hospital.",
    business_terms: ["PO", "order", "EDI 850", "requisition"],
  },
  {
    key: "inventory-request",
    name: "Inventory Request",
    description: "Request to check or reserve inventory for an order.",
    business_terms: ["stock", "availability", "reservation"],
  },
  {
    key: "order-ack",
    name: "Order Acknowledgment",
    description: "Confirmation that a purchase order was accepted.",
    business_terms: ["ACK", "EDI 855", "confirmation"],
  },
  {
    key: "patient-record",
    name: "Patient Record",
    description: "Clinical patient demographic and encounter data.",
    business_terms: ["FHIR", "patient", "demographics"],
  },
];
