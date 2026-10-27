import { Interface, LineageFlow, MessageEvent, Relationship, SourceRecord } from "../models.js";
import { DEFAULT_ENVIRONMENT, DEFAULT_TENANT_ID } from "../demoDefaults.js";
import { mappingAsOf } from "./lineage.js";

const SCOPE = { tenant_id: DEFAULT_TENANT_ID, environment: DEFAULT_ENVIRONMENT };
const IDENTIFIER = /^[a-z_]+$/;
const CATALOG_SOURCE = "integration-catalog-lineage-export";

const brief = (i) => (i ? { key: i.key, name: i.name, protocol: i.protocol, message_type: i.message_type } : null);

// Trace one business identifier (for example a lot number) across every flow.
export async function traceIdentifier(identifier, value) {
  if (!IDENTIFIER.test(identifier)) return { error: "identifier must be a lowercase field name" };
  const field = `business_keys.${identifier}`;
  const filter = { ...SCOPE, [field]: value };
  const customerPipeline = [
    { $match: { ...filter, movement: "shipment" } },
    { $group: { _id: "$business_keys.ship_to", orders: { $addToSet: "$business_keys.po_number" }, shipments: { $addToSet: "$business_keys.shipment_id" }, quantity: { $sum: "$quantity" }, last_shipped_at: { $max: "$observed_at" } } },
    { $sort: { quantity: -1 } },
  ];
  const [events, flows, customers] = await Promise.all([
    MessageEvent.find(filter).sort({ observed_at: 1 }).lean(),
    LineageFlow.find(SCOPE).lean(),
    MessageEvent.aggregate(customerPipeline),
  ]);
  const interfaces = await Interface.find({ key: { $in: [...new Set(events.map((e) => e.interface_key))] } }).lean();
  const ifaceMap = new Map(interfaces.map((i) => [i.key, i]));
  const byFlow = flows
    .map((flow) => {
      const flowEvents = events.filter((e) => e.flow === flow.key);
      const hops = (flow.path || [])
        .filter((key) => flowEvents.some((e) => e.interface_key === key))
        .map((key) => ({
          interface: brief(ifaceMap.get(key)),
          events: flowEvents.filter((e) => e.interface_key === key).map((e) => ({
            message_id: e.message_id,
            observed_at: e.observed_at,
            status: e.status,
            movement: e.movement || null,
            quantity: e.quantity ?? null,
            transaction: e.business_keys?.[flow.identifier],
            business_keys: e.business_keys,
            detail: e.detail,
          })),
        }));
      return { flow: flow.key, name: flow.name, identifier: flow.identifier, transactions: [...new Set(flowEvents.map((e) => e.business_keys?.[flow.identifier]).filter(Boolean))], hops };
    })
    .filter((f) => f.hops.length);
  const sum = (movement) => events.filter((e) => e.movement === movement).reduce((n, e) => n + (e.quantity || 0), 0);
  const received = sum("receipt");
  const shipped = sum("shipment");
  return {
    identifier,
    value,
    flows: byFlow,
    receipts: events.filter((e) => e.movement === "receipt").map((e) => ({ receipt_number: e.business_keys.receipt_number, supplier_po_number: e.business_keys.supplier_po_number, quantity: e.quantity, observed_at: e.observed_at })),
    customers: customers.map((c) => ({ ship_to: c._id, orders: c.orders.filter(Boolean).sort(), shipments: c.shipments.filter(Boolean).sort(), quantity: c.quantity, last_shipped_at: c.last_shipped_at })),
    totals: { received, shipped, on_hand: Math.max(received - shipped, 0) },
    sample_data: true,
    mongodb_trace: {
      collection: "message_events",
      operation: "aggregate",
      code: `db.message_events.aggregate(${JSON.stringify(customerPipeline, null, 2)})`,
      purpose: "Business-key index lookup across flows, grouped by customer to find every hospital that received the identifier.",
    },
  };
}

// Which lineage hops carry an identifier, using the mapping version effective on asOf.
export async function identifierCoverage(identifier, asOf = null) {
  if (!IDENTIFIER.test(identifier)) return { error: "identifier must be a lowercase field name" };
  const flows = await LineageFlow.find(SCOPE).lean();
  const paths = flows.flatMap((f) => f.path || []);
  const [hops, interfaces, internal] = await Promise.all([
    Relationship.find({ relationship_type: "carries", from_key: { $in: paths }, ...SCOPE }).lean(),
    Interface.find({ key: { $in: paths } }).lean(),
    Relationship.find({ relationship_type: "transforms_to", source_system: { $ne: CATALOG_SOURCE }, "review.status": { $ne: "rejected" }, "field_mappings.field": identifier, ...SCOPE }).lean(),
  ]);
  const hopMap = new Map(hops.map((h) => [h.from_key, h]));
  const ifaceMap = new Map(interfaces.map((i) => [i.key, i]));
  const coverage = flows.map((flow) => {
    const rows = (flow.path || []).map((key) => {
      const version = mappingAsOf(hopMap.get(key) || {}, asOf);
      const mapping = (version.field_mappings || []).find((m) => m.field === identifier) || null;
      return { interface: brief(ifaceMap.get(key)), mapped: Boolean(mapping), mapping, mapping_version: version.version, mapping_standard: version.standard || null };
    });
    return { flow: flow.key, name: flow.name, hops: rows, mapped_hops: rows.filter((r) => r.mapped).length };
  });
  return {
    identifier,
    as_of: asOf,
    flows: coverage,
    internal_steps: internal.map((r) => ({ key: r.key, from_key: r.from_key, to_key: r.to_key, transformed_by: r.transformed_by, transformation: r.transformation, source_system: r.source_system, mapping: r.field_mappings.find((m) => m.field === identifier) })),
  };
}

const formatNotice = (record) => ({ key: record.external_id, source_record_id: record.key, observed_at: record.observed_at, ...record.payload });

export async function listRecalls() {
  const records = await SourceRecord.find({ record_type: "recall", ...SCOPE }).sort({ observed_at: -1 }).lean();
  return { recalls: records.map(formatNotice), sample_data: true };
}

// Read-only recall impact: lot trace, untraceable receipts, coverage, and safe actions.
export async function getRecall(recallId, asOf = null) {
  const record = await SourceRecord.findOne({ record_type: "recall", external_id: recallId, ...SCOPE }).lean();
  if (!record) return null;
  const notice = formatNotice(record);
  const [trace, coverage, untraceable] = await Promise.all([
    traceIdentifier("lot_number", notice.lot_number),
    identifierCoverage("lot_number", asOf),
    MessageEvent.find({ ...SCOPE, movement: "receipt", "business_keys.udi_device_identifier": notice.udi_device_identifier, "business_keys.lot_number": { $exists: false } }).sort({ observed_at: 1 }).lean(),
  ]);
  const hospitals = trace.customers.map((c) => c.ship_to);
  const actions = [
    `Quarantine ${trace.totals.on_hand} on-hand units of lot ${notice.lot_number} in Inventory Service.`,
    `Notify ${hospitals.length} affected hospital${hospitals.length === 1 ? "" : "s"}: ${hospitals.join(", ")}.`,
    `Block lot ${notice.lot_number} from new allocations and review open orders for ${notice.product}.`,
    ...(untraceable.length ? [`Confirm with Meridian Medical Supply quality whether ${untraceable.map((e) => e.business_keys.receipt_number).join(", ")} (lot not recorded) contains affected lots.`] : []),
  ];
  return {
    recall: notice,
    trace,
    coverage,
    untraceable_receipts: untraceable.map((e) => ({ receipt_number: e.business_keys.receipt_number, supplier_po_number: e.business_keys.supplier_po_number, quantity: e.quantity, observed_at: e.observed_at, detail: e.detail })),
    recommended_actions: actions,
    owner: "quality-regulatory",
    guardrail: "Read-only recall analysis; no quarantine, notification, or regulatory submission is executed from this demo.",
    sample_data: true,
  };
}
