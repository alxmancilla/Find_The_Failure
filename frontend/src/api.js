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
  ingestion: () => json(`/ingestion`),
  runIngestion: () => json(`/ingestion/run`, { method: "POST" }),
  ingestionQuality: () => json(`/ingestion/quality`),
  systems: () => json(`/systems`),
  scenarios: () => json(`/scenarios`),
  runScenario: (id) => json(`/scenarios/${id}/run`, { method: "POST" }),
};
