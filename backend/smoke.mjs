const base = "http://localhost:4000/api";
const get = async (p) => (await fetch(base + p)).json();
const post = async (p, b) =>
  (await fetch(base + p, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(b || {}),
  })).json();

const s = await get("/search?q=hospital");
console.log("search hospital [", s.engine, "]:", s.interfaces.length, "ifaces,", s.systems.length, "systems,", s.owners.length, "owners");
const fuzzy = await get("/search?q=hosptial");
console.log("fuzzy 'hosptial' [", fuzzy.engine, "]:", fuzzy.interfaces.map((i) => i.name).join(", ") || "(none)");
const mck = await get("/search?q=mckessn");
console.log("fuzzy 'mckessn' [", mck.engine, "]:", mck.systems.map((x) => x.name).join(", ") || "(none)");

const flow = await get("/flow/if-hospital-850");
console.log("flow:", flow.nodes.length, "nodes,", flow.edges.length, "edges,", flow.interfaces.length, "chain");
console.log("  path:", flow.edges.map((e) => `${e.source}->${e.target}`).join(" | "));

const detail = await get("/interfaces/if-hospital-850");
console.log("detail:", detail.name, "| source:", detail.source?.name, "| owners:", detail.owners.map((o) => o.name).join(","));

await post("/reset");
const impact = await post("/simulate/if-integration-erp", { reason: "ERP endpoint timeout", detail: "PO#88231 rejected" });
console.log("simulate: downstream", impact.downstream_interfaces.length, "| affected systems", impact.affected_systems.map((x) => x.name).join(","));
console.log("  owners:", impact.owners.map((o) => `${o.name} (${o.on_call})`).join(","));
console.log("  similar failures:", impact.similar_failures.length);

const mod = await get("/modernization/x12-translator");
console.log("modernization x12:", JSON.stringify(mod.summary));
console.log("  affected:", mod.affected_interfaces.map((i) => i.name).join(" | "));

await post("/reset");

const scen = await get("/scenarios");
console.log("scenarios:", scen.map((s) => s.id).join(", "));
const run = await post("/scenarios/erp-timeout/run");
console.log("run erp-timeout: flow", run.flow.nodes.length, "nodes /", run.flow.edges.length, "edges");
console.log("  failed:", run.impact.interface.name, "->", run.impact.interface.last_status);
console.log("  at risk:", run.impact.affected_systems.map((s) => s.name).join(", "));
console.log("  similar:", run.impact.similar_failures.length);

await post("/reset");
console.log("reset done");
