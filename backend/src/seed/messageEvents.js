import { DEFAULT_ENVIRONMENT, DEFAULT_TENANT_ID } from "../demoDefaults.js";

// Sample B2B message-tracking events keyed by business identifiers: hospital
// orders (PO number), supplier orders (supplier PO number), and stock movements
// carrying lot and device identifiers for recall tracing. Fictional data.
const now = new Date();
const hoursAgo = (h) => new Date(now.getTime() - h * 3600 * 1000);

const LOT = "L-2291";
const UDI = "00812345000017";

const tracked = (flow, idField) => (id, step, interface_key, status, when, latency_ms, detail, extraKeys = {}, movement = {}) => ({
  key: `b2b-tracking:${id}:${step}:${interface_key}`,
  tenant_id: DEFAULT_TENANT_ID,
  environment: DEFAULT_ENVIRONMENT,
  flow,
  interface_key,
  message_id: `MSG-${id.slice(-5)}-${String(step).padStart(2, "0")}`,
  business_keys: { [idField]: id, ...extraKeys },
  status,
  observed_at: when instanceof Date ? when : hoursAgo(when),
  latency_ms,
  detail,
  source_system: "b2b-message-tracking",
  ...movement,
});

const event = tracked("order-to-cash", "po_number");
const supplierEvent = tracked("procure-to-pay", "supplier_po_number");
const lotShipment = (ship_to, shipment_id, quantity) => ({ shipment_id, ship_to, lot_number: LOT, udi_device_identifier: UDI, quantity });

const completed = "PO-4500012345";
const stuck = "PO-4500012388";

// Hospital orders shipped from lot L-2291 that are not yet invoiced.
const shippedOrder = (po, ship_to, shipment_id, quantity, startHoursAgo) => [
  event(po, 1, "if-hospital-850", "delivered", startHoursAgo, 800, `850 received from ${ship_to}.`, { ship_to }),
  event(po, 2, "if-gateway-x12", "delivered", startHoursAgo - 0.1, 1500, "850 translated to canonical order.", { ship_to }),
  event(po, 3, "if-x12-integration", "delivered", startHoursAgo - 0.1, 300, "Canonical order routed to Integration API.", { ship_to }),
  event(po, 4, "if-integration-erp", "delivered", startHoursAgo - 0.2, 2000, "Sales order created in Apex ERP.", { ship_to }),
  event(po, 5, "if-erp-inventory", "delivered", startHoursAgo - 0.2, 650, "Stock reserved.", { ship_to }),
  event(po, 6, "if-erp-855", "delivered", startHoursAgo - 0.5, 950, `855 acknowledgment accepted by ${ship_to}.`, { ship_to }),
  event(po, 7, "if-erp-856", "delivered", startHoursAgo - 10, 1200, `856 ship notice sent for shipment ${shipment_id} (lot ${LOT}).`, lotShipment(ship_to, shipment_id, quantity), { movement: "shipment", quantity }),
];

export const messageEvents = [
  event(completed, 1, "if-hospital-850", "delivered", 120, 820, "850 received from Hospital 123."),
  event(completed, 2, "if-gateway-x12", "delivered", 119.9, 1450, "850 translated to canonical order."),
  event(completed, 3, "if-x12-integration", "delivered", 119.9, 310, "Canonical order routed to Integration API."),
  event(completed, 4, "if-integration-erp", "delivered", 119.8, 2100, "Sales order SO-7781203 created in Apex ERP.", { sales_order_number: "SO-7781203" }),
  event(completed, 5, "if-erp-inventory", "delivered", 119.8, 640, "Stock reserved for 4 order lines."),
  event(completed, 6, "if-erp-855", "delivered", 119.5, 980, "855 acknowledgment accepted by Hospital 123."),
  event(completed, 7, "if-erp-856", "delivered", 96, 1210, `856 ship notice sent for shipment SH-55120 (lot ${LOT}).`, lotShipment("Hospital 123", "SH-55120", 80), { movement: "shipment", quantity: 80 }),
  event(completed, 8, "if-erp-810", "delivered", 90, 1330, "810 invoice INV-9002231 sent.", { invoice_number: "INV-9002231" }),
  event(completed, 9, "if-hospital-820", "delivered", 30, 1720, "820 remittance applied to INV-9002231.", { invoice_number: "INV-9002231" }),

  event(stuck, 1, "if-hospital-850", "delivered", 1.2, 790, "850 received from Hospital 123."),
  event(stuck, 2, "if-gateway-x12", "delivered", 1.15, 1610, "850 translated to canonical order."),
  event(stuck, 3, "if-x12-integration", "delivered", 1.1, 290, "Canonical order routed to Integration API."),
  event(stuck, 4, "if-integration-erp", "failed", 1.0, 180000, "Order-create call to Apex ERP timed out after 180s; no sales order created."),

  ...shippedOrder("PO-4500012401", "St. Mary Regional Medical Center", "SH-55161", 60, 72),
  ...shippedOrder("PO-4500012415", "Lakeside Children's Hospital", "SH-55178", 40, 50),

  // Supplier PO received lot L-2291 (300 units) and completed through payment.
  supplierEvent("SPO-7700451", 1, "if-inventory-supplier", "delivered", 400, 900, "850 replenishment order sent to Meridian Medical Supply."),
  supplierEvent("SPO-7700451", 2, "if-supplier-855", "delivered", 398, 1100, "855 acknowledgment received; 300 units confirmed."),
  supplierEvent("SPO-7700451", 3, "if-supplier-856", "delivered", 300, 1300, `856 ship notice received for lot ${LOT}.`, { shipment_id: "MSN-90812", lot_number: LOT, udi_device_identifier: UDI }),
  supplierEvent("SPO-7700451", 4, "if-receiving-erp", "delivered", 290, 400, `Goods receipt GR-55012 posted: 300 units of lot ${LOT}.`, { receipt_number: "GR-55012", lot_number: LOT, udi_device_identifier: UDI, quantity: 300 }, { movement: "receipt", quantity: 300 }),
  supplierEvent("SPO-7700451", 5, "if-supplier-810", "delivered", 280, 1250, "810 supplier invoice SINV-88231 matched.", { supplier_invoice_number: "SINV-88231" }),
  supplierEvent("SPO-7700451", 6, "if-erp-820-supplier", "delivered", 200, 1400, "820 remittance sent for SINV-88231.", { supplier_invoice_number: "SINV-88231", payment_id: "PAY-3301" }),

  // Supplier PO held at three-way match for a quantity variance.
  supplierEvent("SPO-7700468", 1, "if-inventory-supplier", "delivered", 60, 880, "850 replenishment order sent to Meridian Medical Supply."),
  supplierEvent("SPO-7700468", 2, "if-supplier-855", "delivered", 58, 1050, "855 acknowledgment received; 120 units confirmed."),
  supplierEvent("SPO-7700468", 3, "if-supplier-856", "delivered", 40, 1280, "856 ship notice received for lot L-2307.", { shipment_id: "MSN-91044", lot_number: "L-2307", udi_device_identifier: UDI }),
  supplierEvent("SPO-7700468", 4, "if-receiving-erp", "delivered", 38, 420, "Goods receipt GR-55190 posted: 100 units of lot L-2307.", { receipt_number: "GR-55190", lot_number: "L-2307", udi_device_identifier: UDI, quantity: 100 }, { movement: "receipt", quantity: 100 }),
  supplierEvent("SPO-7700468", 5, "if-supplier-810", "on_hold", 20, 1300, "Three-way match hold: invoiced 120 units but received 100 (0% quantity tolerance).", { supplier_invoice_number: "SINV-88507" }),

  // Supplier PO received before the 856 v2 mapping captured lots (untraceable by lot).
  supplierEvent("SPO-7690112", 1, "if-inventory-supplier", "delivered", new Date("2025-06-02T15:00:00Z"), 950, "850 replenishment order sent to Meridian Medical Supply."),
  supplierEvent("SPO-7690112", 2, "if-supplier-855", "delivered", new Date("2025-06-02T19:00:00Z"), 1200, "855 acknowledgment received; 250 units confirmed."),
  supplierEvent("SPO-7690112", 3, "if-supplier-856", "delivered", new Date("2025-06-09T10:00:00Z"), 1350, "856 ship notice received (v1 mapping: lot not captured).", { shipment_id: "MSN-84410", udi_device_identifier: UDI }),
  supplierEvent("SPO-7690112", 4, "if-receiving-erp", "delivered", new Date("2025-06-10T08:00:00Z"), 380, "Goods receipt GR-51877 posted: 250 units, lot not recorded.", { receipt_number: "GR-51877", udi_device_identifier: UDI, quantity: 250 }, { movement: "receipt", quantity: 250 }),
  supplierEvent("SPO-7690112", 5, "if-supplier-810", "delivered", new Date("2025-06-12T09:00:00Z"), 1240, "810 supplier invoice SINV-84102 matched.", { supplier_invoice_number: "SINV-84102" }),
  supplierEvent("SPO-7690112", 6, "if-erp-820-supplier", "delivered", new Date("2025-07-10T09:00:00Z"), 1380, "820 remittance sent for SINV-84102.", { supplier_invoice_number: "SINV-84102", payment_id: "PAY-2988" }),
];
