import { Interface, System } from "../models.js";
import { GRAPH_LOOKUP_MAX_DEPTH } from "./graphConfig.js";

const dependsOn = { from_type: "interface", to_type: "interface", relationship_type: "depends_on" };

// Traverse depends_on edges in `relationships` (the canonical edge store) and
// hydrate the reached interfaces, ordered by hop depth.
async function traverseDependencies(interfaceKey, downstream) {
  const [start] = await Interface.aggregate([
    { $match: { key: interfaceKey } },
    {
      $graphLookup: {
        from: "relationships",
        startWith: "$key",
        connectFromField: downstream ? "to_key" : "from_key",
        connectToField: downstream ? "from_key" : "to_key",
        as: "edges",
        maxDepth: GRAPH_LOOKUP_MAX_DEPTH,
        depthField: "depth",
        restrictSearchWithMatch: dependsOn,
      },
    },
  ]);
  if (!start) return null;
  const edges = start.edges || [];
  delete start.edges;
  const depthByKey = new Map();
  edges.forEach((e) => {
    const key = downstream ? e.to_key : e.from_key;
    if (key !== interfaceKey && (!depthByKey.has(key) || e.depth < depthByKey.get(key))) depthByKey.set(key, e.depth);
  });
  const reached = await Interface.find({ key: { $in: [...depthByKey.keys()] } }).lean();
  reached.sort((a, b) => depthByKey.get(a.key) - depthByKey.get(b.key) || a.key.localeCompare(b.key));
  return { start, reached };
}

// The start interface followed by its downstream dependency chain.
export async function getDownstreamInterfaces(startKey) {
  const result = await traverseDependencies(startKey, true);
  return result ? [result.start, ...result.reached] : null;
}

// Interfaces upstream of the given interface.
export async function getUpstreamInterfaces(interfaceKey) {
  const result = await traverseDependencies(interfaceKey, false);
  return result ? result.reached : [];
}

// Build a React Flow style node/edge graph for the dependency path of an
// interface. Nodes are systems; edges are interfaces between them.
export async function buildFlow(startKey) {
  const chain = await getDownstreamInterfaces(startKey);
  if (!chain) return null;

  const systemKeys = new Set();
  for (const iface of chain) {
    if (iface.source) systemKeys.add(iface.source);
    if (iface.target) systemKeys.add(iface.target);
    (iface.middleware || []).forEach((m) => systemKeys.add(m));
  }

  const systems = await System.find({ key: { $in: [...systemKeys] } }).lean();
  const systemMap = Object.fromEntries(systems.map((s) => [s.key, s]));

  const nodes = [...systemKeys].map((key) => {
    const sys = systemMap[key] || { key, name: key };
    return {
      id: key,
      type: "system",
      data: {
        key,
        label: sys.name,
        kind: sys.kind,
        vendor: sys.vendor,
        owner: sys.owner,
        description: sys.description,
      },
    };
  });

  const edges = chain.map((iface) => ({
    id: iface.key,
    source: iface.source,
    target: iface.target,
    data: {
      key: iface.key,
      label: iface.name,
      protocol: iface.protocol,
      type: iface.type,
      message_type: iface.message_type,
      last_status: iface.last_status,
      lifecycle: iface.lifecycle,
    },
  }));

  return { startKey, nodes, edges, interfaces: chain };
}
