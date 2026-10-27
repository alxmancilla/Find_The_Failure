import { Interface, System, Owner, Event } from "../models.js";
import { getDownstreamInterfaces } from "./graph.js";
import {
  getBusinessProcessContext,
  traceInterfaceRelationships,
} from "./relationships.js";
import { getDataImpact, getSystemLineageImpact } from "./lineage.js";
import { events as seedEvents } from "../seed/events.js";
import { DEFAULT_ENVIRONMENT, DEFAULT_TENANT_ID } from "../demoDefaults.js";

export const EVENT_SCOPE = { tenant_id: DEFAULT_TENANT_ID, environment: DEFAULT_ENVIRONMENT };

// Full impact picture for a (possibly failing) interface: which interfaces and
// systems are downstream, who owns it, and similar recent failures.
export async function getImpact(interfaceKey) {
  const iface = await Interface.findOne({ key: interfaceKey }).lean();
  if (!iface) return null;

  const relationshipTrace = await traceInterfaceRelationships(interfaceKey);
  const typedDownstream = relationshipTrace.interfaces.filter((i) => i.key !== interfaceKey);
  const chain = (await getDownstreamInterfaces(interfaceKey)) || [iface];
  const downstream = chain.filter((i) => i.key !== interfaceKey);
  const impactedInterfaces = typedDownstream.length ? typedDownstream : downstream;
  const impactedKeys = [iface.key, ...impactedInterfaces.map((i) => i.key)];
  const processContext = await getBusinessProcessContext(impactedKeys);

  const systemKeys = new Set();
  impactedInterfaces.forEach((i) => {
    if (i.target) systemKeys.add(i.target);
    (i.downstream_systems || []).forEach((s) => systemKeys.add(s));
  });
  (iface.downstream_systems || []).forEach((s) => systemKeys.add(s));

  const [systems, owners, recent, similar, dataImpact] = await Promise.all([
    System.find({ key: { $in: [...systemKeys] } }).lean(),
    Owner.find({ key: { $in: iface.owners || [] } }).lean(),
    Event.find({ ...EVENT_SCOPE, interface_key: interfaceKey }).sort({ timestamp: -1 }).limit(5).lean(),
    findSimilarFailures(interfaceKey),
    getDataImpact(impactedKeys),
  ]);

  return {
    interface: iface,
    downstream_interfaces: impactedInterfaces,
    affected_systems: systems,
    owners,
    recent_events: recent,
    similar_failures: similar,
    business_processes: processContext.business_processes,
    process_relationships: processContext.relationships,
    relationship_trace: relationshipTrace,
    data_impact: dataImpact,
  };
}

// Similar recent failures: same interface or same failure reason elsewhere.
export async function findSimilarFailures(interfaceKey) {
  const iface = await Interface.findOne({ key: interfaceKey }).lean();
  const lastFailure = await Event.findOne({ ...EVENT_SCOPE, interface_key: interfaceKey, status: "failed" })
    .sort({ timestamp: -1 })
    .lean();

  const or = [{ interface_key: interfaceKey, status: "failed" }];
  if (lastFailure?.reason) or.push({ status: "failed", reason: lastFailure.reason });
  if (iface?.type) or.push({ status: "failed", message_type: iface.message_type });

  return Event.find({ ...EVENT_SCOPE, $or: or }).sort({ timestamp: -1 }).limit(5).lean();
}

// Simulate a failure by recording a failed event and flagging the interface.
export async function simulateFailure(interfaceKey, reason, detail) {
  const iface = await Interface.findOne({ key: interfaceKey });
  if (!iface) return null;

  iface.last_status = "failed";
  await iface.save();

  await Event.create({
    interface_key: interfaceKey,
    status: "failed",
    message_type: iface.message_type,
    reason: reason || "ERP endpoint timeout",
    detail: detail || "Simulated failure injected from the Impact Explorer.",
    severity: "critical",
  });

  return getImpact(interfaceKey);
}

// Reset to a pristine demo state: all interfaces healthy and the event history
// restored to the original seed (drops any simulated failures).
export async function resetStatuses() {
  await Interface.updateMany({}, { $set: { last_status: "healthy" } });
  await Event.deleteMany({});
  await Event.insertMany(seedEvents);
  return { ok: true };
}

// Modernization: what is impacted if we replace/change a system (e.g. the X12
// translator)? Find every interface that touches it as source, target, or hop.
export async function getModernizationImpact(systemKey) {
  const system = await System.findOne({ key: systemKey }).lean();
  const affected = await Interface.find({
    $or: [{ source: systemKey }, { target: systemKey }, { middleware: systemKey }],
  }).lean();

  const ownerKeys = new Set();
  const downstreamKeys = new Set();
  affected.forEach((i) => {
    (i.owners || []).forEach((o) => ownerKeys.add(o));
    (i.downstream_systems || []).forEach((s) => downstreamKeys.add(s));
  });

  const [owners, downstreamSystems, lineageImpact] = await Promise.all([
    Owner.find({ key: { $in: [...ownerKeys] } }).lean(),
    System.find({ key: { $in: [...downstreamKeys] } }).lean(),
    getSystemLineageImpact(systemKey),
  ]);

  return {
    system,
    affected_interfaces: affected,
    owners,
    downstream_systems: downstreamSystems,
    lineage_impact: lineageImpact,
    summary: {
      interface_count: affected.length,
      owner_count: owners.length,
      downstream_count: downstreamSystems.length,
    },
  };
}
