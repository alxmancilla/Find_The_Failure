const base = "/api";

async function json(path, opts) {
  const res = await fetch(base + path, opts);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  search: (q) => json(`/search?q=${encodeURIComponent(q)}`),
  interface: (key) => json(`/interfaces/${key}`),
  flow: (key) => json(`/flow/${key}`),
  impact: (key) => json(`/impact/${key}`),
  simulate: (key, body) =>
    json(`/simulate/${key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
    }),
  reset: () => json(`/reset`, { method: "POST" }),
  modernization: (systemKey) => json(`/modernization/${systemKey}`),
  systems: () => json(`/systems`),
  scenarios: () => json(`/scenarios`),
  runScenario: (id) => json(`/scenarios/${id}/run`, { method: "POST" }),
};
