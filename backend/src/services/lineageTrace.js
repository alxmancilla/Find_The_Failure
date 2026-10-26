import { LineageFlow, MessageEvent } from "../models.js";
import { DEFAULT_ENVIRONMENT, DEFAULT_TENANT_ID } from "../demoDefaults.js";
import { getDataImpact, getLineageFlow } from "./lineage.js";

const SCOPE = { tenant_id: DEFAULT_TENANT_ID, environment: DEFAULT_ENVIRONMENT };

const deriveStatus = (events, pathLength) => {
  if (events.some((e) => e.status === "failed")) return "failed";
  const delivered = new Set(events.filter((e) => e.status === "delivered").map((e) => e.interface_key));
  return delivered.size >= pathLength ? "completed" : "in_progress";
};

// Sample transactions for a flow, grouped by the flow's business identifier.
export async function listFlowTransactions(flowKey) {
  const flow = await LineageFlow.findOne({ key: flowKey, ...SCOPE }).lean();
  if (!flow) return null;
  const idPath = `business_keys.${flow.identifier}`;
  const events = await MessageEvent.find({ flow: flowKey, ...SCOPE, [idPath]: { $exists: true } }).sort({ observed_at: 1 }).lean();
  const byId = new Map();
  events.forEach((e) => {
    const id = e.business_keys[flow.identifier];
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(e);
  });
  const transactions = [...byId.entries()].map(([value, list]) => ({
    value,
    status: deriveStatus(list, (flow.path || []).length),
    hops_observed: list.length,
    first_seen_at: list[0].observed_at,
    last_seen_at: list[list.length - 1].observed_at,
  }));
  return { flow: flow.key, identifier: flow.identifier, identifier_label: flow.identifier_label, transactions, sample_data: true };
}

// Align one transaction's tracking events to the flow path: where it is, where
// it stopped, and which downstream documents lineage says are now at risk.
export async function traceFlowTransaction(flowKey, value) {
  const design = await getLineageFlow(flowKey);
  if (!design) return null;
  const filter = { flow: flowKey, ...SCOPE, [`business_keys.${design.identifier}`]: value };
  const events = await MessageEvent.find(filter).sort({ observed_at: 1 }).lean();
  if (!events.length) return { flow: flowKey, identifier: design.identifier, value, status: "not_found", steps: [] };

  const latest = new Map();
  events.forEach((e) => latest.set(e.interface_key, e));
  let blocked = false;
  const steps = design.steps.map((step) => {
    const event = latest.get(step.interface.key) || null;
    const status = event ? event.status : blocked ? "blocked" : "not_reached";
    if (event?.status === "failed") blocked = true;
    return {
      step: step.step,
      interface: step.interface,
      from_system: step.from_system,
      to_system: step.to_system,
      output_entity: step.output_entity,
      identifier_mapping: step.identifier_mapping,
      status,
      event: event && {
        message_id: event.message_id,
        observed_at: event.observed_at,
        latency_ms: event.latency_ms,
        detail: event.detail,
        business_keys: event.business_keys,
      },
    };
  });
  const status = deriveStatus(events, design.steps.length);
  const stuck = steps.find((s) => s.status === "failed") || null;
  const dataImpact = stuck ? await getDataImpact([stuck.interface.key], flowKey) : null;
  return {
    flow: flowKey,
    identifier: design.identifier,
    identifier_label: design.identifier_label,
    value,
    status,
    stuck_at: stuck,
    delivered_hops: steps.filter((s) => s.status === "delivered").length,
    steps,
    data_impact: dataImpact,
    sample_data: true,
    summary: stuck
      ? `${value} stopped at step ${stuck.step} (${stuck.interface.name}). ${dataImpact?.summary || ""}`.trim()
      : status === "completed"
        ? `${value} completed all ${steps.length} hops through ${steps[steps.length - 1]?.output_entity?.name || "the final document"}.`
        : `${value} is in progress: ${steps.filter((s) => s.status === "delivered").length} of ${steps.length} hops delivered.`,
    mongodb_trace: {
      collection: "message_events",
      operation: "find",
      code: `db.message_events.find(${JSON.stringify(filter)}).sort({ observed_at: 1 })`,
      purpose: "Business-key index lookup of tracking events, aligned to the flow path from lineage_flows.",
    },
  };
}
