import { Interface, InvestigationCase, Owner, SourceRecord, System } from "../models.js";
import { demoFeedAlerts } from "../seed/sourceRecords.js";
import { getImpact } from "./impact.js";
import { traceInterfaceRelationships } from "./relationships.js";

export async function listAlerts() {
  const alerts = await SourceRecord.find({ record_type: "alert" })
    .sort({ observed_at: -1 })
    .lean();
  return { alerts: alerts.map(formatAlert) };
}

export async function ingestDemoAlerts() {
  const now = new Date();
  const keys = demoFeedAlerts.map((alert) => alert.key);
  const existing = await SourceRecord.find({ key: { $in: keys } }).select("key").lean();
  const existingKeys = new Set(existing.map((alert) => alert.key));

  await SourceRecord.bulkWrite(
    demoFeedAlerts.map((alert, index) => ({
      updateOne: {
        filter: { key: alert.key },
        update: {
          $set: {
            ...alert,
            observed_at: new Date(now.getTime() - index * 20 * 60 * 1000),
            ingestion_status: "ingested",
            ingested_at: now,
          },
          $setOnInsert: { createdAt: now },
        },
        upsert: true,
      },
    }))
  );

  const listed = await listAlerts();
  return {
    ok: true,
    inserted_alerts: keys.filter((key) => !existingKeys.has(key)).length,
    upserted_alerts: keys.length,
    alerts: listed.alerts,
  };
}

export async function listInvestigationCases() {
  const cases = await InvestigationCase.find()
    .sort({ updatedAt: -1 })
    .limit(12)
    .lean();
  return { cases: cases.map(formatCase) };
}

export async function getInvestigationCase(caseKey) {
  const doc = await InvestigationCase.findOne({ key: caseKey }).lean();
  return doc ? formatCase(doc) : null;
}

export async function createInvestigationCase(sourceRecordKey) {
  const investigation = await investigateAlert(sourceRecordKey);
  if (!investigation || investigation.error) return investigation ? { investigation } : null;

  const now = new Date();
  const key = `case-${now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 7)}`;
  const doc = await InvestigationCase.create({
    key,
    alert_key: sourceRecordKey,
    alert_snapshot: investigation.alert,
    status: "open",
    summary: investigation.investigation_summary,
    top_fault_domain: investigation.likely_fault_domains?.[0],
    investigation_result: investigation,
    evidence: investigation.evidence || [],
    recommended_next_actions: investigation.recommended_next_actions || [],
    timeline: buildCaseTimeline(now, investigation),
    messages: [],
  });

  return { case: formatCase(doc.toObject()), investigation };
}

export async function appendCaseMessages(caseKey, question, answer) {
  const now = new Date();
  const doc = await InvestigationCase.findOneAndUpdate(
    { key: caseKey },
    {
      $push: {
        messages: {
          $each: [
            { at: now, role: "user", text: question },
            { at: now, role: "agent", text: answer, grounded_in: ["investigation_result", "evidence", "topology"] },
          ],
        },
        timeline: {
          at: now,
          event: "follow_up_answered",
          label: "Grounded follow-up answered",
          detail: question,
          status: "complete",
        },
      },
    },
    { new: true }
  ).lean();
  return doc ? formatCase(doc) : null;
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

function buildCaseTimeline(start, investigation) {
  const at = (minutes) => new Date(start.getTime() + minutes * 60 * 1000);
  const alert = investigation.alert;
  const iface = investigation.topology.alert_interface;
  const top = investigation.likely_fault_domains?.[0];
  return [
    { at: at(0), event: "case_opened", label: "Case opened", detail: `Created from ${alert.reason}.`, status: "complete" },
    { at: at(1), event: "alert_mapped", label: "Alert mapped", detail: `Mapped ${alert.external_id} to ${iface.name}.`, status: "complete" },
    { at: at(2), event: "topology_loaded", label: "Topology loaded", detail: `${investigation.topology.downstream_interfaces.length} downstream interfaces found.`, status: "complete" },
    { at: at(3), event: "impact_assessed", label: "Impact assessed", detail: `${investigation.affected_systems.length} affected systems identified.`, status: "complete" },
    { at: at(4), event: "evidence_collected", label: "Evidence collected", detail: `${investigation.evidence.length} evidence items attached.`, status: "complete" },
    { at: at(5), event: "fault_ranked", label: "Fault domain ranked", detail: `${top?.name || "Top candidate"} ranked highest.`, status: "complete" },
    { at: at(6), event: "next_checks_ready", label: "Next checks ready", detail: `${investigation.recommended_next_actions.length} human-reviewable checks prepared.`, status: "complete" },
  ];
}

function formatCase(doc) {
  return {
    key: doc.key,
    alert_key: doc.alert_key,
    alert_snapshot: doc.alert_snapshot,
    status: doc.status,
    summary: doc.summary,
    top_fault_domain: doc.top_fault_domain,
    investigation_result: doc.investigation_result,
    evidence_count: doc.evidence?.length || 0,
    recommended_next_actions: doc.recommended_next_actions || [],
    timeline: doc.timeline || [],
    messages: doc.messages || [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}