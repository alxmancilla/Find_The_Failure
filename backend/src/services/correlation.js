import { Interface, Owner, SourceRecord, System } from "../models.js";
import { getImpact } from "./impact.js";
import { traceInterfaceRelationships } from "./relationships.js";

export async function listAlerts() {
  const alerts = await SourceRecord.find({ record_type: "alert" })
    .sort({ observed_at: -1 })
    .lean();
  return { alerts: alerts.map(formatAlert) };
}

export async function investigateAlert(sourceRecordKey) {
  const alert = await SourceRecord.findOne({ key: sourceRecordKey, record_type: "alert" }).lean();
  if (!alert) return null;

  const iface = await Interface.findOne({ key: alert.entity_key }).lean();
  if (!iface) return { alert: formatAlert(alert), error: "mapped interface not found" };

  const [upstream, downstream, impact] = await Promise.all([
    traceInterfaceRelationships(iface.key, "upstream"),
    traceInterfaceRelationships(iface.key, "downstream"),
    getImpact(iface.key),
  ]);

  const systemKeys = [...new Set([
    iface.source,
    iface.target,
    ...(impact?.affected_systems || []).map((s) => s.key),
  ].filter(Boolean))];
  const ownerKeys = [...new Set([
    ...(iface.owners || []),
    ...(impact?.downstream_interfaces || []).flatMap((i) => i.owners || []),
  ])];
  const [systems, owners] = await Promise.all([
    System.find({ key: { $in: systemKeys } }).lean(),
    Owner.find({ key: { $in: ownerKeys } }).lean(),
  ]);

  const candidates = rankFaultDomains(alert, iface, upstream, downstream, systems);
  return {
    alert: formatAlert(alert),
    investigation_summary: buildSummary(alert, iface, candidates, impact),
    likely_fault_domains: candidates,
    impacted_business_processes: impact?.business_processes || [],
    affected_systems: impact?.affected_systems || [],
    owners,
    topology: {
      alert_interface: iface,
      upstream_interfaces: upstream.interfaces.filter((i) => i.key !== iface.key),
      downstream_interfaces: impact?.downstream_interfaces || downstream.interfaces.filter((i) => i.key !== iface.key),
      relationship_edges: [...upstream.relationships, ...downstream.relationships],
    },
    evidence: collectEvidence(alert, upstream, downstream, impact),
    recommended_next_actions: [
      `Page ${owners[0]?.name || "the owning integration team"}.`,
      `Check ${iface.target} health before restarting upstream senders.`,
      "Use relationship evidence to confirm blast radius with application owners.",
    ],
  };
}

function formatAlert(alert) {
  return {
    key: alert.key,
    source_system: alert.source_system,
    external_id: alert.external_id,
    interface_key: alert.entity_key,
    observed_at: alert.observed_at,
    severity: alert.payload?.severity || "warning",
    status: alert.payload?.status || "degraded",
    reason: alert.payload?.reason || "Imported observability alert",
    detail: alert.payload?.detail,
    evidence: alert.evidence || [],
  };
}

function rankFaultDomains(alert, iface, upstream, downstream, systems) {
  const byKey = Object.fromEntries(systems.map((s) => [s.key, s]));
  const upstreamDepth = upstream.relationships.length ? 0.12 : 0;
  return [
    {
      type: "system",
      key: iface.target,
      name: byKey[iface.target]?.name || iface.target,
      score: 0.92,
      reason: `Alert is emitted on ${iface.name}, whose target is ${iface.target}.`,
    },
    {
      type: "interface",
      key: iface.key,
      name: iface.name,
      score: 0.84,
      reason: alert.payload?.detail || "Alert is directly mapped to this integration interface.",
    },
    {
      type: "upstream-path",
      key: "upstream-dependency-chain",
      name: "Upstream dependency chain",
      score: Number((0.55 + upstreamDepth).toFixed(2)),
      reason: `${upstream.relationships.length} upstream relationship edges can contribute to the symptom.`,
    },
    {
      type: "downstream-blast-radius",
      key: "downstream-impact-chain",
      name: "Downstream impact chain",
      score: Number((0.45 + Math.min(downstream.relationships.length, 5) * 0.04).toFixed(2)),
      reason: `${downstream.relationships.length} downstream relationship edges define affected consumers.`,
    },
  ].sort((a, b) => b.score - a.score);
}

function buildSummary(alert, iface, candidates, impact) {
  const process = impact?.business_processes?.[0]?.name || "the mapped business process";
  return `${alert.payload?.reason || "Alert"} maps to ${iface.name}. ` +
    `Most likely fault domain is ${candidates[0]?.name}. ` +
    `Potential business impact: ${process}.`;
}

function collectEvidence(alert, upstream, downstream, impact) {
  const relationshipEvidence = [...upstream.relationships, ...downstream.relationships, ...(impact?.process_relationships || [])]
    .flatMap((r) => r.evidence || [])
    .slice(0, 8);
  return [...(alert.evidence || []), ...relationshipEvidence];
}