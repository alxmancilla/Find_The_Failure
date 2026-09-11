import { Event, Interface, InvestigationCase, Owner, SourceRecord, System } from "../models.js";
import { demoFeedAlertKeys, demoFeedAlerts } from "../seed/sourceRecords.js";
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

export async function clearWorkbenchDemoState() {
  const keys = demoFeedAlertKeys;
  const [sourceRecords, events, cases] = await Promise.all([
    SourceRecord.deleteMany({ key: { $in: keys } }),
    Event.deleteMany({ source_record_id: { $in: keys } }),
    InvestigationCase.deleteMany({}),
  ]);
  const [alerts, caseMemory] = await Promise.all([listAlerts(), listInvestigationCases()]);

  return {
    ok: true,
    deleted_feed_alerts: sourceRecords.deletedCount,
    deleted_feed_events: events.deletedCount,
    deleted_cases: cases.deletedCount,
    alerts: alerts.alerts,
    cases: caseMemory.cases,
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

  const candidates = rankFaultDomains(alert, iface, upstream, downstream, systems, impact);
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
    business_process_key: alert.payload?.business_process_key,
    business_process_name: alert.payload?.business_process_name,
    evidence: alert.evidence || [],
  };
}

function rankFaultDomains(alert, iface, upstream, downstream, systems, impact) {
  const byKey = Object.fromEntries(systems.map((s) => [s.key, s]));
  const targetConfidence = scoreTargetConfidence(alert, iface, upstream, downstream, impact);
  const upstreamDepth = Math.min(upstream.relationships.length, 4) * 0.04;
  const downstreamBreadth = Math.min(downstream.relationships.length, 5) * 0.035;
  return [
    {
      type: "system",
      key: iface.target,
      name: byKey[iface.target]?.name || iface.target,
      score: targetConfidence,
      reason: buildConfidenceReason(alert, iface, upstream, downstream, impact, targetConfidence),
    },
    {
      type: "interface",
      key: iface.key,
      name: iface.name,
      score: clampScore(targetConfidence - 0.08, 0.68, 0.88),
      reason: alert.payload?.detail || "Alert is directly mapped to this integration interface.",
    },
    {
      type: "upstream-path",
      key: "upstream-dependency-chain",
      name: "Upstream dependency chain",
      score: clampScore(0.52 + upstreamDepth, 0.52, 0.78),
      reason: `${upstream.relationships.length} upstream relationship edges can contribute to the symptom.`,
    },
    {
      type: "downstream-blast-radius",
      key: "downstream-impact-chain",
      name: "Downstream impact chain",
      score: clampScore(0.46 + downstreamBreadth, 0.46, 0.76),
      reason: `${downstream.relationships.length} downstream relationship edges define affected consumers.`,
    },
  ].sort((a, b) => b.score - a.score);
}

function scoreTargetConfidence(alert, iface, upstream, downstream, impact) {
  const relationships = [...upstream.relationships, ...downstream.relationships, ...(impact?.process_relationships || [])];
  const confirmed = relationships.filter((r) => r.confirmed).length;
  const inferred = relationships.filter((r) => r.confirmed === false).length;
  const processCount = impact?.business_processes?.length || 0;
  const evidenceCount = collectEvidence(alert, upstream, downstream, impact).length;
  const symptom = `${alert.payload?.reason || ""} ${alert.payload?.detail || ""}`.toLowerCase();

  let score = 0.64;
  score += alert.entity_key === iface.key ? 0.12 : 0;
  score += alert.payload?.severity === "critical" ? 0.05 : 0.02;
  score += alert.payload?.status === "failed" ? 0.06 : 0.03;
  score += /timeout|failure|failed|acknowledg/.test(symptom) ? 0.04 : 0.01;
  score += Math.min(evidenceCount, 4) * 0.01;
  score += Math.min(relationships.length, 6) * 0.008;
  score += relationships.length && confirmed / relationships.length >= 0.8 ? 0.04 : 0;
  score += processCount === 1 ? 0.04 : processCount > 1 ? 0.02 : 0;
  score += (iface.owners || []).length ? 0.02 : 0;
  score -= processCount > 1 ? 0.03 : 0;
  score -= downstream.relationships.length > 2 ? 0.02 : 0;
  score -= inferred ? 0.03 : 0;
  score -= /backlog|lag|delay|delayed|queue/.test(symptom) ? 0.03 : 0;

  return clampScore(score, 0.72, maxConfidenceFor(alert, processCount, downstream.relationships.length, symptom));
}

function maxConfidenceFor(alert, processCount, downstreamEdges, symptom) {
  let max = alert.payload?.status === "failed" && alert.payload?.severity === "critical" ? 0.93 : 0.9;
  if (alert.payload?.severity === "critical" && alert.payload?.status !== "failed") max = 0.92;
  if (processCount > 1 || downstreamEdges > 2) max = Math.min(max, 0.91);
  if (/backlog|queue/.test(symptom)) max = Math.min(max, 0.85);
  if (/lag/.test(symptom)) max = Math.min(max, 0.84);
  if (/delay|delayed/.test(symptom)) max = Math.min(max, 0.86);
  if (/acknowledg/.test(symptom)) max = Math.max(max, 0.9);
  return max;
}

function buildConfidenceReason(alert, iface, upstream, downstream, impact, score) {
  const processCount = impact?.business_processes?.length || 0;
  const relationships = [...upstream.relationships, ...downstream.relationships, ...(impact?.process_relationships || [])];
  const confirmed = relationships.filter((r) => r.confirmed).length;
  const evidenceCount = collectEvidence(alert, upstream, downstream, impact).length;
  const ambiguity = processCount > 1 || downstream.relationships.length > 2
    ? " Shared-process or broad downstream impact slightly lowers certainty."
    : " Narrow process mapping increases certainty.";
  return `Ranking confidence ${Math.round(score * 100)}%: alert maps directly to ${iface.name}, ` +
    `${evidenceCount} evidence items are available, and ${confirmed}/${relationships.length || 0} relationship edges are confirmed.` +
    ambiguity;
}

function clampScore(value, min, max) {
  return Number(Math.min(max, Math.max(min, value)).toFixed(2));
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