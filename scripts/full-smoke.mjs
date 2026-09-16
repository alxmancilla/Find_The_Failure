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
  assert(fixtureLoad.source_records_loaded >= 6, "enterprise fixture pack did not load");
  const ingestion = await get("/ingestion");
  assert(Array.isArray(ingestion.source_records), "ingestion dashboard missing source records");
  assert(ingestion.quality.fixture_records >= 6, "fixture records missing from dashboard");
  assert(ingestion.pipeline.length === 4, "ingestion pipeline summary missing");
  const ingestionRun = await post("/ingestion/run");
  assert(ingestionRun.ok === true, "ingestion run failed");
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
  const investigation = await get("/investigation/" + encodeURIComponent(feed.alerts[0].key));
  assert(investigation.related_context.documents.length > 0, "related context missing");
  assert(investigation.mongodb_trace.related, "MongoDB related trace missing");
  const created = await post("/cases/investigate/" + encodeURIComponent(feed.alerts[0].key));
  assert(created.case?.timeline?.some((item) => item.event === "related_context_retrieved"), "case memory incomplete");
  const cases = await get("/cases");
  assert(cases.cases.length >= 1, "case list empty after create");
  await cleanup();

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
      relationships: ingestionRun.relationship_upserts,
      events: ingestionRun.event_upserts,
      provenanceCoverage: quality.provenance_coverage,
      ownershipConflicts: quality.ownership_conflicts.length,
    },
    qualityFindings: quality.findings.length,
    scenarios: scenarios.length,
    retrievalEngine: investigation.related_context.engine,
    relatedContext: investigation.related_context.documents.length,
    caseTimelineEvents: created.case.timeline.length,
    finalState: "workbench feed/cases cleared and demo reset",
  }, null, 2));
} catch (err) {
  await cleanup();
  console.error(err.message);
  process.exit(1);
}
