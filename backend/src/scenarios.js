// Pre-scripted, repeatable demo scenarios. Each names the interface that fails,
// which interface to root the dependency graph on, and the failure details.
export const scenarios = [
  {
    id: "erp-timeout",
    name: "EDI 850 rejected — ERP timeout",
    description:
      "A hospital purchase order is rejected because the McKesson ERP endpoint times out.",
    flow_start: "if-hospital-850",
    interface_key: "if-integration-erp",
    reason: "ERP endpoint timeout",
    detail:
      "EDI 850 order PO#88231 rejected: McKesson ERP endpoint timed out after 3 minutes.",
  },
  {
    id: "x12-latency",
    name: "X12 translation SLA breach",
    description:
      "The X12 translator exceeds its SLA under peak load, backing up orders in the gateway.",
    flow_start: "if-hospital-850",
    interface_key: "if-gateway-x12",
    reason: "X12 translation SLA breach",
    detail:
      "X12 translator exceeded the 2-minute translation SLA under peak load; orders queuing in the gateway.",
  },
];

export const getScenario = (id) => scenarios.find((s) => s.id === id);
