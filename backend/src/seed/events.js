// Historical operational events give context for "similar recent failures".
const now = new Date();
const daysAgo = (d) => new Date(now.getTime() - d * 86400 * 1000);
const hoursAgo = (h) => new Date(now.getTime() - h * 3600 * 1000);

export const events = [
  {
    interface_key: "if-integration-erp",
    timestamp: hoursAgo(1),
    status: "success",
    message_type: "order-create",
    reason: "Order created",
    detail: "PO#88231 accepted by McKesson ERP.",
    severity: "info",
  },
  {
    interface_key: "if-integration-erp",
    timestamp: daysAgo(2),
    status: "failed",
    message_type: "order-create",
    reason: "ERP endpoint timeout",
    detail: "McKesson ERP did not respond within 3 minutes (PO#87990).",
    severity: "critical",
  },
  {
    interface_key: "if-integration-erp",
    timestamp: daysAgo(9),
    status: "failed",
    message_type: "order-create",
    reason: "ERP endpoint timeout",
    detail: "Connection reset during ERP maintenance window (PO#86540).",
    severity: "critical",
  },
  {
    interface_key: "if-gateway-x12",
    timestamp: daysAgo(5),
    status: "degraded",
    message_type: "850",
    reason: "Slow translation",
    detail: "X12 translation latency exceeded SLA during peak load.",
    severity: "warning",
  },
  {
    interface_key: "if-hospital-850",
    timestamp: hoursAgo(1),
    status: "success",
    message_type: "850",
    reason: "Order received",
    detail: "EDI 850 received from Hospital 123 (PO#88231).",
    severity: "info",
  },
];
