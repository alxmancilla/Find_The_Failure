import { Event, Interface, InvestigationCase, Owner, SourceRecord, System } from "../models.js";
import { demoFeedAlertKeys, demoFeedAlerts } from "../seed/sourceRecords.js";
import { getImpact } from "./impact.js";
import { GRAPH_LOOKUP_MAX_DEPTH } from "./graphConfig.js";
import { findRelatedContext } from "./relatedContext.js";
import { traceInterfaceRelationships } from "./relationships.js";

const ALERT_LIFECYCLE_STATUSES = new Set(["new", "acknowledged", "investigating", "escalated", "resolved"]);
const ALERT_LIFECYCLE_LABELS = {
  new: "New",
  acknowledged: "Acknowledged",
  investigating: "Investigating",
  escalated: "Escalated",
  resolved: "Resolved",
};

export async function listAlerts() {
  const alerts = await SourceRecord.find({ record_type: "alert" })
    .sort({ observed_at: -1 })
    .lean();
  return { alerts: alerts.map(formatAlert) };
}

export async function updateAlertLifecycle(sourceRecordKey, status, actor = "demo-operator") {
  if (!ALERT_LIFECYCLE_STATUSES.has(status)) {
    return { error: `unsupported lifecycle status: ${status}` };
  }

  const now = new Date();
  const historyEntry = { at: now, status, actor, note: lifecycleNote(status) };
  const alert = await SourceRecord.findOneAndUpdate(
    { key: sourceRecordKey, record_type: "alert" },
    {
      $set: {
        "workbench_lifecycle.status": status,
        "workbench_lifecycle.updated_at": now,
        "workbench_lifecycle.updated_by": actor,
      },
      $push: { "workbench_lifecycle.history": historyEntry },
    },
    { new: true }
  ).lean();

  return alert ? { alert: formatAlert(alert) } : null;
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
          $unset: { workbench_lifecycle: "" },
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
  const [sourceRecords, events, cases, lifecycle] = await Promise.all([
    SourceRecord.deleteMany({ key: { $in: keys } }),
    Event.deleteMany({ source_record_id: { $in: keys } }),
    InvestigationCase.deleteMany({}),
    SourceRecord.updateMany({ record_type: "alert" }, { $unset: { workbench_lifecycle: "" } }),
  ]);
  const [alerts, caseMemory] = await Promise.all([listAlerts(), listInvestigationCases()]);

  return {
    ok: true,
    deleted_feed_alerts: sourceRecords.deletedCount,
    deleted_feed_events: events.deletedCount,
    deleted_cases: cases.deletedCount,
    reset_lifecycle_alerts: lifecycle.modifiedCount || 0,
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
  const lifecycle = await updateAlertLifecycle(sourceRecordKey, "investigating", "agent-workbench");
  const persistedInvestigation = {
    ...investigation,
    alert: lifecycle?.alert || investigation.alert,
    mongodb_trace: addCaseWriteTrace(investigation.mongodb_trace, key, sourceRecordKey),
  };
  const doc = await InvestigationCase.create({
    key,
    alert_key: sourceRecordKey,
    alert_snapshot: persistedInvestigation.alert,
    status: "open",
    summary: persistedInvestigation.investigation_summary,
    top_fault_domain: persistedInvestigation.likely_fault_domains?.[0],
    investigation_result: persistedInvestigation,
    evidence: persistedInvestigation.evidence || [],
    recommended_next_actions: persistedInvestigation.recommended_next_actions || [],
    timeline: buildCaseTimeline(now, persistedInvestigation),
    messages: [],
  });

  return { case: formatCase(doc.toObject()), investigation: persistedInvestigation };
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
  const baseEvidence = collectEvidence(alert, upstream, downstream, impact);
  const [systems, owners, relatedContext, changeCorrelation] = await Promise.all([
    System.find({ key: { $in: systemKeys } }).lean(),
    Owner.find({ key: { $in: ownerKeys } }).lean(),
    findRelatedContext(alert, iface, impact),
    findChangeCorrelation(alert, iface, impact, systemKeys),
  ]);
  const relatedEvidence = formatRelatedEvidence(relatedContext.documents);
  const changeEvidence = formatChangeEvidence(changeCorrelation.documents);
  const evidence = [...baseEvidence, ...changeEvidence, ...relatedEvidence];

  const candidates = rankFaultDomains(alert, iface, upstream, downstream, systems, impact);
  return {
    alert: formatAlert(alert),
    investigation_summary: buildSummary(alert, iface, candidates, impact),
    likely_fault_domains: candidates,
    impacted_business_processes: impact?.business_processes || [],
    affected_systems: impact?.affected_systems || [],
    owners,
    change_correlation: changeCorrelation,
    related_context: relatedContext,
    topology: {
      alert_interface: iface,
      upstream_interfaces: upstream.interfaces.filter((i) => i.key !== iface.key),
      downstream_interfaces: impact?.downstream_interfaces || downstream.interfaces.filter((i) => i.key !== iface.key),
      relationship_edges: [...upstream.relationships, ...downstream.relationships],
    },
    evidence,
    recommended_next_actions: [
      `Page ${owners[0]?.name || "the owning integration team"}.`,
      `Check ${iface.target} health before restarting upstream senders.`,
      changeCorrelation.top_change ? `Review recent change ${changeCorrelation.top_change.external_id}: ${changeCorrelation.top_change.summary}.` : "Review recent deployment, config, and route changes for the alert window.",
      relatedContext.documents[0] ? `Review related context: ${relatedContext.documents[0].title}.` : "Search related runbooks and incident notes for matching symptoms.",
      "Use relationship evidence to confirm blast radius with application owners.",
    ],
    mongodb_trace: buildMongoTrace(sourceRecordKey, alert, iface, upstream, downstream, impact, systemKeys, ownerKeys, evidence, relatedContext, changeCorrelation),
  };
}

function formatAlert(alert) {
  const lifecycle = formatLifecycle(alert.workbench_lifecycle);
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
    lifecycle,
    lifecycle_status: lifecycle.status,
    evidence: alert.evidence || [],
  };
}

function formatLifecycle(lifecycle = {}) {
  const status = ALERT_LIFECYCLE_STATUSES.has(lifecycle.status) ? lifecycle.status : "new";
  const history = Array.isArray(lifecycle.history) ? lifecycle.history.slice(-5) : [];
  return {
    status,
    label: ALERT_LIFECYCLE_LABELS[status] || "New",
    updated_at: lifecycle.updated_at,
    updated_by: lifecycle.updated_by,
    history_count: lifecycle.history?.length || 0,
    history,
  };
}

function lifecycleNote(status) {
  return {
    new: "Alert reopened for review.",
    acknowledged: "Alert acknowledged in the Workbench.",
    investigating: "Investigation case opened.",
    escalated: "Marked for human-approved escalation.",
    resolved: "Marked resolved for demo tracking.",
  }[status] || "Lifecycle status updated.";
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

function formatRelatedEvidence(documents = []) {
  return documents.slice(0, 3).map((doc) => `Related ${doc.type}: ${doc.title} — ${doc.snippet || doc.text}`);
}

function formatChangeEvidence(documents = []) {
  return documents.slice(0, 3).map((change) => `Recent change ${change.external_id}: ${change.summary} (${change.time_context}, ${Math.round(change.score * 100)}% correlation).`);
}

async function findChangeCorrelation(alert, iface, impact, systemKeys) {
  const windowMinutes = 180;
  const alertTime = new Date(alert.observed_at || Date.now());
  const windowStart = new Date(alertTime.getTime() - windowMinutes * 60 * 1000);
  const windowEnd = new Date(alertTime.getTime() + 15 * 60 * 1000);
  const processKeys = [alert.payload?.business_process_key, ...(impact?.business_processes || []).map((p) => p.key)].filter(Boolean);
  const assetKeys = [...new Set([iface.key, ...systemKeys].filter(Boolean))];
  const filter = changeCorrelationFilter(assetKeys, processKeys, windowStart, windowEnd);
  const records = await SourceRecord.find(filter).sort({ observed_at: -1 }).limit(8).lean();
  const documents = records
    .map((record) => formatChangeRecord(record, alertTime, assetKeys, processKeys))
    .sort((a, b) => b.score - a.score || Math.abs(a.minutes_from_alert) - Math.abs(b.minutes_from_alert))
    .slice(0, 3);
  const top = documents[0];

  return {
    query_window_minutes: windowMinutes,
    filter,
    documents,
    top_change: top || null,
    summary: top
      ? `${documents.length} recent change${documents.length === 1 ? "" : "s"} correlated; strongest hypothesis is ${top.external_id} on ${top.asset_name}.`
      : "No recent changes matched the alert interface, adjacent systems, or business process window.",
  };
}

function changeCorrelationFilter(assetKeys, processKeys, windowStart, windowEnd) {
  return {
    record_type: "change",
    observed_at: { $gte: windowStart, $lte: windowEnd },
    $or: [
      { entity_key: { $in: assetKeys } },
      { "payload.asset_key": { $in: assetKeys } },
      { "payload.business_process_key": { $in: processKeys } },
    ],
  };
}

function formatChangeRecord(record, alertTime, assetKeys, processKeys) {
  const minutesFromAlert = Math.round((alertTime.getTime() - new Date(record.observed_at).getTime()) / 60000);
  const directAsset = assetKeys.includes(record.entity_key) || assetKeys.includes(record.payload?.asset_key);
  const processMatch = processKeys.includes(record.payload?.business_process_key);
  const proximity = Math.max(0, 1 - Math.min(Math.abs(minutesFromAlert), 180) / 180);
  let score = 0.42 + proximity * 0.24;
  score += directAsset ? 0.18 : 0;
  score += processMatch ? 0.1 : 0;
  score += record.payload?.risk === "high" ? 0.08 : record.payload?.risk === "medium" ? 0.04 : 0;
  score += record.payload?.change_type === "deployment" || record.payload?.change_type === "route" ? 0.04 : 0;

  return {
    key: record.key,
    external_id: record.external_id,
    source_system: record.source_system,
    change_type: record.payload?.change_type || "change",
    asset_type: record.payload?.asset_type || record.entity_type,
    asset_key: record.payload?.asset_key || record.entity_key,
    asset_name: record.payload?.asset_key || record.entity_key,
    business_process_key: record.payload?.business_process_key,
    business_process_name: record.payload?.business_process_name,
    observed_at: record.observed_at,
    minutes_from_alert: minutesFromAlert,
    time_context: minutesFromAlert >= 0 ? `${minutesFromAlert} min before alert` : `${Math.abs(minutesFromAlert)} min after alert`,
    summary: record.payload?.summary || "Recent operational change",
    detail: record.payload?.detail,
    risk: record.payload?.risk || "unknown",
    actor: record.payload?.actor,
    score: clampScore(score, 0.42, 0.92),
    rationale: `${directAsset ? "Direct asset match" : "Adjacent context match"}; ${processMatch ? "business process match" : "process not mapped"}; ${minutesFromAlert >= 0 ? "occurred before" : "occurred after"} the alert window.`,
    evidence: record.evidence || [],
  };
}

function buildMongoTrace(sourceRecordKey, alert, iface, upstream, downstream, impact, systemKeys, ownerKeys, evidence, relatedContext, changeCorrelation) {
  const impactedInterfaceKeys = [iface.key, ...(impact?.downstream_interfaces || []).map((i) => i.key)];
  const processKeys = (impact?.business_processes || []).map((p) => p.key);
  const relationshipMatch = {
    from_type: "interface",
    to_type: "interface",
    relationship_type: "depends_on",
  };

  return {
    received: stageTrace("Durable alert intake and case memory", [
      op("SourceRecord", "source_records", "findOne", {
        filter: { key: sourceRecordKey, record_type: "alert" },
        chain: ".lean()",
        purpose: "Load the raw observability alert selected from the Workbench inbox.",
      }),
    ]),
    mapped: stageTrace("Canonical interface mapping", [
      op("Interface", "interfaces", "findOne", {
        filter: { key: alert.entity_key },
        chain: ".lean()",
        purpose: "Resolve the alert entity key to a canonical interface document.",
      }),
      op("System", "systems", "find", {
        filter: { key: { $in: systemKeys } },
        chain: ".lean()",
        purpose: "Load source, target, and affected system context for the mapped path.",
      }),
      op("Owner", "owners", "find", {
        filter: { key: { $in: ownerKeys } },
        chain: ".lean()",
        purpose: "Load accountable team metadata for the mapped interface and downstream path.",
      }),
    ]),
    topology: stageTrace("Operational context graph traversal", [
      aggregateOp("Relationship", "relationships", upstreamPipeline(iface.key, relationshipMatch), "Trace upstream dependency edges using $graphLookup."),
      aggregateOp("Relationship", "relationships", downstreamPipeline(iface.key, relationshipMatch), "Trace downstream dependency edges using $graphLookup."),
      op("Interface", "interfaces", "find", {
        filter: { key: { $in: [...new Set([iface.key, ...upstream.interfaces.map((i) => i.key), ...downstream.interfaces.map((i) => i.key)])] } },
        chain: ".lean()",
        purpose: "Hydrate relationship keys into interface documents for the graph.",
      }),
    ]),
    impact: stageTrace("Business-process impact lookup", [
      op("Relationship", "relationships", "find", {
        filter: {
          from_type: "interface",
          from_key: { $in: impactedInterfaceKeys },
          to_type: "business_process",
          relationship_type: "supports_process",
        },
        chain: ".lean()",
        purpose: "Map impacted interfaces to supported business processes.",
      }),
      op("BusinessProcess", "business_processes", "find", {
        filter: { key: { $in: processKeys } },
        chain: ".lean()",
        purpose: "Load business process names and descriptions for the impact summary.",
      }),
      op("Event", "events", "find", {
        filter: { interface_key: iface.key },
        chain: ".sort({ timestamp: -1 }).limit(5).lean()",
        purpose: "Load recent events for operational impact context.",
      }),
    ]),
    related: stageTrace("Atlas retrieval for related operational context", [relatedContext.trace_operation]),
    changes: stageTrace("Recent change correlation", [
      op("SourceRecord", "source_records", "find", {
        filter: changeCorrelation.filter,
        chain: ".sort({ observed_at: -1 }).limit(8).lean()",
        purpose: "Find recent deployment, config, route, and partner changes near the alert window that touch the interface, adjacent systems, or business process.",
      }),
    ]),
    evidence: stageTrace("Grounded evidence and provenance", [
      aggregateOp("Relationship", "relationships", downstreamPipeline(iface.key, relationshipMatch), "Read relationship documents whose evidence fields ground the dependency path."),
      {
        collection: "relationships",
        operation: "aggregate",
        pipeline: evidencePipeline(iface.key, relationshipMatch),
        code: `db.relationships.aggregate(${queryLiteral(evidencePipeline(iface.key, relationshipMatch))})`,
        purpose: "Project relationship evidence fields that ground the dependency path.",
      },
    ]),
    ranked: stageTrace("Evidence-based fault-domain ranking", [
      op("SourceRecord", "source_records", "findOne", {
        filter: { key: sourceRecordKey, record_type: "alert" },
        chain: ".lean()",
        purpose: "Input: alert severity, status, direct mapped entity, and alert evidence.",
      }),
      aggregateOp("Relationship", "relationships", upstreamPipeline(iface.key, relationshipMatch), "Input: upstream topology breadth used to score dependency ambiguity."),
      aggregateOp("Relationship", "relationships", downstreamPipeline(iface.key, relationshipMatch), "Input: downstream topology breadth and blast-radius context used by the scorer."),
      op("System", "systems", "find", {
        filter: { key: { $in: systemKeys } },
        chain: ".lean()",
        purpose: "Input: source/target system metadata used to label ranked fault-domain candidates.",
      }),
    ]),
    summary: stageTrace("Auditable recommendations and follow-up memory", [
      {
        collection: "investigation_cases",
        operation: "insertOne",
        filter: { alert_key: sourceRecordKey, top_fault_domain: null },
        code: `db.investigation_cases.insertOne(${queryLiteral(caseInsertTraceDoc(null, sourceRecordKey))})`,
        purpose: "Persist generated next checks, evidence, timeline, and summary as resumable case memory when the Workbench opens a case.",
      },
    ]),
  };
}

function addCaseWriteTrace(trace, caseKey, sourceRecordKey) {
  if (!trace?.summary?.operations?.length) return trace;
  return {
    ...trace,
    received: {
      ...trace.received,
      operations: [
        ...trace.received.operations,
        {
          collection: "investigation_cases",
          operation: "insertOne",
          filter: { key: caseKey, alert_key: sourceRecordKey },
          code: `db.investigation_cases.insertOne(${queryLiteral(caseInsertTraceDoc(caseKey, sourceRecordKey))})`,
          purpose: "Create the auditable case record for this investigation run.",
        },
      ],
    },
    summary: {
      ...trace.summary,
      operations: trace.summary.operations.map((operation) => operation.collection === "investigation_cases"
        ? {
          ...operation,
          filter: { key: caseKey, alert_key: sourceRecordKey },
          code: `db.investigation_cases.insertOne(${queryLiteral(caseInsertTraceDoc(caseKey, sourceRecordKey))})`,
        }
        : operation),
    },
  };
}

function stageTrace(capability, operations) {
  return {
    capability,
    collections: [...new Set(operations.map((operation) => operation.collection))],
    operations,
  };
}

function op(_model, collection, operation, { filter, chain = "", purpose }) {
  return {
    collection,
    operation,
    filter,
    code: `db.${collection}.${operation}(${queryLiteral(filter)})${mongoShellChain(chain)}`,
    purpose,
  };
}

function aggregateOp(_model, collection, pipeline, purpose) {
  return {
    collection,
    operation: "aggregate",
    pipeline,
    code: `db.${collection}.aggregate(${queryLiteral(pipeline)})`,
    purpose,
  };
}

function upstreamPipeline(interfaceKey, relationshipMatch) {
  return relationshipPipeline({ ...relationshipMatch, to_key: interfaceKey }, false, relationshipMatch);
}

function downstreamPipeline(interfaceKey, relationshipMatch) {
  return relationshipPipeline({ ...relationshipMatch, from_key: interfaceKey }, true, relationshipMatch);
}

function relationshipPipeline(match, downstream, relationshipMatch) {
  return [
    { $match: match },
    {
      $graphLookup: {
        from: "relationships",
        startWith: downstream ? "$to_key" : "$from_key",
        connectFromField: downstream ? "to_key" : "from_key",
        connectToField: downstream ? "from_key" : "to_key",
        as: "chain",
        maxDepth: GRAPH_LOOKUP_MAX_DEPTH,
        depthField: "depth",
        restrictSearchWithMatch: relationshipMatch,
      },
    },
  ];
}

function evidencePipeline(interfaceKey, relationshipMatch) {
  return [
    ...downstreamPipeline(interfaceKey, relationshipMatch),
    { $project: { key: 1, from_key: 1, to_key: 1, evidence: 1, confidence: 1 } },
  ];
}

function mongoShellChain(chain) {
  return chain.replaceAll(".lean()", "");
}

function caseInsertTraceDoc(caseKey, sourceRecordKey) {
  return {
    ...(caseKey ? { key: caseKey } : {}),
    alert_key: sourceRecordKey,
    alert_snapshot: "<selected alert snapshot>",
    status: "open",
    summary: "<generated investigation summary>",
    top_fault_domain: "<highest ranked candidate>",
    investigation_result: "<full grounded investigation result>",
    evidence: "<evidence strings>",
    recommended_next_actions: "<generated next checks>",
    timeline: "<case timeline events>",
    messages: [],
  };
}

function queryLiteral(value) {
  return JSON.stringify(value, null, 2);
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
    { at: at(4), event: "related_context_retrieved", label: "Related context retrieved", detail: `${investigation.related_context?.documents?.length || 0} runbook/incident notes found.`, status: "complete" },
    { at: at(5), event: "changes_correlated", label: "Recent changes correlated", detail: `${investigation.change_correlation?.documents?.length || 0} nearby changes evaluated.`, status: "complete" },
    { at: at(6), event: "evidence_collected", label: "Evidence collected", detail: `${investigation.evidence.length} evidence items attached.`, status: "complete" },
    { at: at(7), event: "fault_ranked", label: "Fault domain ranked", detail: `${top?.name || "Top candidate"} ranked highest.`, status: "complete" },
    { at: at(8), event: "next_checks_ready", label: "Next checks ready", detail: `${investigation.recommended_next_actions.length} human-reviewable checks prepared.`, status: "complete" },
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