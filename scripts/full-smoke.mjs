const base = "http://localhost:4000/api";

async function request(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

const get = (path) => request("GET", path);
const post = (path, body = {}) => request("POST", path, body);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

async function cleanup() {
  await post("/ingestion/fixtures/clear").catch(() => null);
  await post("/workbench/clear-demo-state").catch(() => null);
  await post("/reset").catch(() => null);
}

try {
  const health = await get("/health");
  assert(health.ok === true, "health failed");

  const searchApex = await get("/search?q=apex");
  assert(searchApex.interfaces.length > 0 || searchApex.systems.length > 0, "search apex empty");
  const typo = await get("/search?q=hosptial");
  assert(typo.interfaces.length > 0, "typo-tolerant search empty");

  const interfaces = await get("/interfaces");
  assert(interfaces.length >= 10, "interfaces count too low");
  const detail = await get("/interfaces/if-hospital-850");
  assert(detail.source && detail.target && detail.owners.length, "interface detail incomplete");

  const flow = await get("/flow/if-hospital-850");
  assert(flow.nodes.length >= 8 && flow.edges.length >= 7, "dependency flow incomplete");
  const trace = await get("/relationships/trace/if-hospital-850?direction=downstream");
  assert(trace.interfaces.length >= 1, "relationship trace empty");

  const impact = await get("/impact/if-integration-erp");
  assert(impact.affected_systems.length >= 3, "impact analysis incomplete");
  const modernization = await get("/modernization/x12-translator");
  assert(modernization.affected_interfaces.length >= 1, "modernization analysis incomplete");

  await post("/ingestion/fixtures/clear");
  const fixtureLoad = await post("/ingestion/fixtures");
  assert(fixtureLoad.source_records_loaded >= 10, "enterprise fixture pack did not load");
  const ingestion = await get("/ingestion");
  assert(Array.isArray(ingestion.source_records), "ingestion dashboard missing source records");
  assert(ingestion.quality.fixture_records >= 10, "fixture records missing from dashboard");
  const scopedFixtureRecord = ingestion.source_records.find((record) => record.fixture_group === "enterprise-context-pack");
  assert(scopedFixtureRecord?.tenant_id === "apex-health-supply", "fixture record tenant metadata missing");
  assert(scopedFixtureRecord?.environment === "production", "fixture record environment metadata missing");
  assert(ingestion.pipeline.length === 4, "ingestion pipeline summary missing");
  const ingestionRun = await post("/ingestion/run");
  assert(ingestionRun.ok === true, "ingestion run failed");
  const fixtureAlerts = await get("/alerts");
  const externalAlerts = fixtureAlerts.alerts.filter((alert) => alert.source_system === "alertmanager-webhook");
  assert(externalAlerts.length >= 2, "external Alertmanager alerts missing");
  assert(fixtureAlerts.raw_alerts_count > fixtureAlerts.alerts.length, "dedupe should preserve more raw alerts than visible inbox items");
  assert(fixtureAlerts.suppressed_alerts_count >= 1, "dedupe suppressed count missing");
  const groupedAlert = externalAlerts.find((alert) => alert.dedupe?.signal_count > 1);
  assert(groupedAlert, "grouped Alertmanager alert missing");
  const fixtureInvestigation = await get("/investigation/" + encodeURIComponent(groupedAlert.key));
  assert(fixtureInvestigation.alert_deduplication.signal_count > 1, "investigation dedupe metadata missing");
  assert(fixtureInvestigation.likely_fault_domains.every((candidate) => candidate.score_components?.factors?.length), "fault-domain score components missing");
  assert(fixtureInvestigation.mongodb_trace.dedupe, "MongoDB dedupe trace missing");
  assert(fixtureInvestigation.change_correlation.documents.length > 0, "change correlation missing");
  assert(fixtureInvestigation.mongodb_trace.changes, "MongoDB change trace missing");
  const quality = await get("/ingestion/quality");
  assert(Array.isArray(quality.findings), "ingestion quality missing findings");
  assert(quality.provenance_coverage > 0, "provenance coverage missing");
  assert(quality.ownership_conflicts.length >= 1, "ownership conflict demo finding missing");
  await post("/ingestion/fixtures/clear");

  const scenarios = await get("/scenarios");
  assert(scenarios.length >= 3, "scenarios missing");
  const supplierScenario = await post("/scenarios/supplier-replenishment-lag/run");
  assert(supplierScenario.flow.nodes.length > 0 && supplierScenario.impact.interface, "supplier scenario failed");
  await post("/reset");

  const feed = await post("/alerts/demo-feed");
  assert(feed.alerts.length >= 4, "demo feed alerts missing");
  assert(feed.raw_alerts_count >= feed.alerts.length, "alert feed raw/group counts missing");
  assert(feed.alerts.every((alert) => alert.lifecycle_status === "new"), "alerts should default lifecycle to new");
  const acknowledged = await post(`/alerts/${encodeURIComponent(feed.alerts[0].key)}/lifecycle`, { status: "acknowledged" });
  assert(acknowledged.alert.lifecycle_status === "acknowledged", "alert lifecycle acknowledge failed");
  const investigation = await get("/investigation/" + encodeURIComponent(feed.alerts[0].key));
  assert(investigation.related_context.documents.length > 0, "related context missing");
  assert(investigation.alert.tenant_id === "apex-health-supply", "alert tenant metadata missing");
  assert(investigation.mongodb_trace.related, "MongoDB related trace missing");
  const created = await post("/cases/investigate/" + encodeURIComponent(feed.alerts[0].key));
  assert(created.investigation.alert.lifecycle_status === "investigating", "case create did not mark alert investigating");
  assert(created.case?.tenant_id === "apex-health-supply", "case tenant projection missing");
  assert(created.case?.interface_key, "case interface projection missing");
  assert(created.case?.business_process_key, "case business-process projection missing");
  assert(typeof created.case?.confidence_score === "number", "case confidence projection missing");
  assert(created.case?.related_context_keys?.length > 0, "case related-context projection missing");
  assert(created.case?.timeline?.some((item) => item.event === "alert_deduplicated"), "case timeline missing dedupe step");
  assert(created.case?.timeline?.some((item) => item.event === "related_context_retrieved"), "case memory incomplete");
  assert(created.case?.timeline?.some((item) => item.event === "similar_cases_retrieved"), "case timeline missing similar-case step");
  const repeatedInvestigation = await get("/investigation/" + encodeURIComponent(feed.alerts[0].key));
  assert(repeatedInvestigation.similar_cases.documents.length >= 1, "similar-case retrieval missing prior case");
  assert(repeatedInvestigation.similar_cases.documents.some((item) => item.key === created.case.key), "similar-case retrieval did not include created case");
  assert(repeatedInvestigation.similar_cases.documents[0].match_reasons.length >= 1, "similar-case match reasons missing");
  assert(repeatedInvestigation.mongodb_trace.similar, "MongoDB similar-case trace missing");
  const followup = await post(`/cases/${encodeURIComponent(created.case.key)}/messages`, { question: "What evidence supports this?" });
  assert(followup.answer.text.includes("strongest evidence"), "grounded follow-up answer missing expected content");
  assert(followup.answer.grounded_in.includes("evidence"), "grounded follow-up sources missing evidence grounding");
  assert(followup.answer.mongodb_trace?.operations?.length >= 2, "grounded follow-up MongoDB trace missing");
  assert(followup.case.messages.length === 2, "grounded follow-up messages not persisted");
  assert(followup.case.messages[1].grounded_in.includes("evidence"), "persisted agent message missing grounding metadata");
  const cases = await get("/cases");
  assert(cases.cases.length >= 1, "case list empty after create");
  await cleanup();
  const resetAlerts = await get("/alerts");
  assert(resetAlerts.alerts.every((alert) => alert.lifecycle_status === "new"), "reset should clear alert lifecycle metadata");

  console.log(JSON.stringify({
    ok: true,
    searchEngine: searchApex.engine,
    typoSearchEngine: typo.engine,
    interfaces: interfaces.length,
    flow: { nodes: flow.nodes.length, edges: flow.edges.length },
    impactSystems: impact.affected_systems.length,
    ingestion: {
      records: ingestion.source_records.length,
      fixtureRecords: ingestion.quality.fixture_records,
      changeRecords: ingestion.quality.records_by_type.change || 0,
      relationships: ingestionRun.relationship_upserts,
      events: ingestionRun.event_upserts,
      provenanceCoverage: quality.provenance_coverage,
      ownershipConflicts: quality.ownership_conflicts.length,
    },
    qualityFindings: quality.findings.length,
    scenarios: scenarios.length,
    retrievalEngine: investigation.related_context.engine,
    dedupeSuppressed: fixtureAlerts.suppressed_alerts_count,
    dedupeSignals: fixtureInvestigation.alert_deduplication.signal_count,
    changeCorrelation: fixtureInvestigation.change_correlation.documents.length,
    relatedContext: investigation.related_context.documents.length,
    similarCases: repeatedInvestigation.similar_cases.documents.length,
    groundedFollowUps: followup.case.messages.length / 2,
    lifecycleStatus: created.investigation.alert.lifecycle_status,
    caseTimelineEvents: followup.case.timeline.length,
    finalState: "workbench feed/cases cleared and demo reset",
  }, null, 2));
} catch (err) {
  await cleanup();
  console.error(err.message);
  process.exit(1);
}
