import { DEFAULT_ENVIRONMENT, DEFAULT_TENANT_ID } from "../demoDefaults.js";

// B2B message-tracking events for two sample hospital orders, keyed by PO
// number so each order can be traced against the order-to-cash lineage path.
const now = new Date();
const hoursAgo = (h) => new Date(now.getTime() - h * 3600 * 1000);

const event = (po, step, interface_key, status, observedHoursAgo, latency_ms, detail, extraKeys = {}) => ({
  key: `b2b-tracking:${po}:${step}:${interface_key}`,
  tenant_id: DEFAULT_TENANT_ID,
  environment: DEFAULT_ENVIRONMENT,
  flow: "order-to-cash",
  interface_key,
  message_id: `MSG-${po.slice(-5)}-${String(step).padStart(2, "0")}`,
  business_keys: { po_number: po, ...extraKeys },
  status,
  observed_at: hoursAgo(observedHoursAgo),
  latency_ms,
  detail,
  source_system: "b2b-message-tracking",
});

const completed = "PO-4500012345";
const stuck = "PO-4500012388";

export const messageEvents = [
  event(completed, 1, "if-hospital-850", "delivered", 120, 820, "850 received from Hospital 123."),
  event(completed, 2, "if-gateway-x12", "delivered", 119.9, 1450, "850 translated to canonical order."),
  event(completed, 3, "if-x12-integration", "delivered", 119.9, 310, "Canonical order routed to Integration API."),
  event(completed, 4, "if-integration-erp", "delivered", 119.8, 2100, "Sales order SO-7781203 created in Apex ERP.", { sales_order_number: "SO-7781203" }),
  event(completed, 5, "if-erp-inventory", "delivered", 119.8, 640, "Stock reserved for 4 order lines."),
  event(completed, 6, "if-erp-855", "delivered", 119.5, 980, "855 acknowledgment accepted by Hospital 123."),
  event(completed, 7, "if-erp-856", "delivered", 96, 1210, "856 ship notice sent for shipment SH-55120.", { shipment_id: "SH-55120" }),
  event(completed, 8, "if-erp-810", "delivered", 90, 1330, "810 invoice INV-9002231 sent.", { invoice_number: "INV-9002231" }),
  event(completed, 9, "if-hospital-820", "delivered", 30, 1720, "820 remittance applied to INV-9002231.", { invoice_number: "INV-9002231" }),

  event(stuck, 1, "if-hospital-850", "delivered", 1.2, 790, "850 received from Hospital 123."),
  event(stuck, 2, "if-gateway-x12", "delivered", 1.15, 1610, "850 translated to canonical order."),
  event(stuck, 3, "if-x12-integration", "delivered", 1.1, 290, "Canonical order routed to Integration API."),
  event(stuck, 4, "if-integration-erp", "failed", 1.0, 180000, "Order-create call to Apex ERP timed out after 180s; no sales order created."),
];
