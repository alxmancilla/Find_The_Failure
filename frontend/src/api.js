const base = "/api";

async function json(path, opts) {
  const res = await fetch(base + path, opts);
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // Keep the HTTP status fallback if the response is not JSON.
    }
    throw new Error(message);
  }
  return res.json();
}

export const api = {
  search: (q) => json(`/search?q=${encodeURIComponent(q)}`),
  interface: (key) => json(`/interfaces/${key}`),
  flow: (key) => json(`/flow/${key}`),
  impact: (key) => json(`/impact/${key}`),
  relationshipTrace: (key, direction = "downstream") =>
    json(`/relationships/trace/${key}?direction=${encodeURIComponent(direction)}`),
  simulate: (key, body) =>
    json(`/simulate/${key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
    }),
  reset: () => json(`/reset`, { method: "POST" }),
  modernization: (systemKey) => json(`/modernization/${systemKey}`),
  lineageFlows: () => json(`/lineage/flows`),
  lineageEntities: (flowKey = "order-to-cash") => json(`/lineage/entities?flow=${encodeURIComponent(flowKey)}`),
  lineage: (entityKey, direction = "both", asOf = "", flowKey = "order-to-cash") =>
    json(`/lineage/${encodeURIComponent(entityKey)}?direction=${encodeURIComponent(direction)}&flow=${encodeURIComponent(flowKey)}${asOf ? `&as_of=${encodeURIComponent(asOf)}` : ""}`),
  identifierCoverage: (identifier, asOf = "") =>
    json(`/lineage/identifiers/${encodeURIComponent(identifier)}/coverage${asOf ? `?as_of=${encodeURIComponent(asOf)}` : ""}`),
  recalls: () => json(`/recalls`),
  recall: (recallId, asOf = "") => json(`/recalls/${encodeURIComponent(recallId)}${asOf ? `?as_of=${encodeURIComponent(asOf)}` : ""}`),
  lineageFlow: (flowKey = "order-to-cash") => json(`/lineage/flows/${encodeURIComponent(flowKey)}`),
  lineageTransactions: (flowKey = "order-to-cash") => json(`/lineage/flows/${encodeURIComponent(flowKey)}/transactions`),
  lineageTransaction: (value, flowKey = "order-to-cash") =>
    json(`/lineage/flows/${encodeURIComponent(flowKey)}/transactions/${encodeURIComponent(value)}`),
  lineageMetamodel: () => json(`/lineage/metamodel`),
  lineageReviews: () => json(`/lineage/reviews`),
  reviewLineageEdge: (edgeKey, body) => json(`/lineage/edges/${encodeURIComponent(edgeKey)}/review`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  }),
  clearLineageReviews: () => json(`/lineage/reviews/clear`, { method: "POST" }),
  ingestion: () => json(`/ingestion`),
  runIngestion: () => json(`/ingestion/run`, { method: "POST" }),
  loadEnterpriseFixtures: () => json(`/ingestion/fixtures`, { method: "POST" }),
  clearEnterpriseFixtures: () => json(`/ingestion/fixtures/clear`, { method: "POST" }),
  ingestionQuality: () => json(`/ingestion/quality`),
  alerts: () => json(`/alerts`),
  ingestDemoAlerts: () => json(`/alerts/demo-feed`, { method: "POST" }),
  updateAlertLifecycle: (sourceRecordKey, body) => json(`/alerts/${encodeURIComponent(sourceRecordKey)}/lifecycle`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  }),
  clearWorkbenchDemoState: () => json(`/workbench/clear-demo-state`, { method: "POST" }),
  investigation: (sourceRecordKey) => json(`/investigation/${encodeURIComponent(sourceRecordKey)}`),
  cases: () => json(`/cases`),
  case: (caseKey) => json(`/cases/${encodeURIComponent(caseKey)}`),
  createInvestigationCase: (sourceRecordKey) => json(`/cases/investigate/${encodeURIComponent(sourceRecordKey)}`, { method: "POST" }),
  answerCaseFollowUp: (caseKey, body) => json(`/cases/${encodeURIComponent(caseKey)}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  }),
  recordApprovalDecision: (caseKey, body) => json(`/cases/${encodeURIComponent(caseKey)}/approval-decision`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  }),
  recordCaseOutcome: (caseKey, body) => json(`/cases/${encodeURIComponent(caseKey)}/outcome`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  }),
  systems: () => json(`/systems`),
  scenarios: () => json(`/scenarios`),
  runScenario: (id) => json(`/scenarios/${id}/run`, { method: "POST" }),
};
