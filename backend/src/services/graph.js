import { Interface, System } from "../models.js";

// Collect the ordered chain of interfaces starting from a given interface,
// following downstream_interfaces via $graphLookup (relationship traversal).
export async function getDownstreamInterfaces(startKey) {
  const result = await Interface.aggregate([
    { $match: { key: startKey } },
    {
      $graphLookup: {
        from: "interfaces",
        startWith: "$downstream_interfaces",
        connectFromField: "downstream_interfaces",
        connectToField: "key",
        as: "chain",
        maxDepth: 20,
      },
    },
  ]);
  if (!result.length) return null;
  const start = result[0];
  const chain = start.chain || [];
  delete start.chain;
  return [start, ...chain];
}

// Interfaces that flow INTO a system (its upstream) — used for impact/upstream.
export async function getUpstreamInterfaces(interfaceKey) {
  const result = await Interface.aggregate([
    { $match: { key: interfaceKey } },
    {
      $graphLookup: {
        from: "interfaces",
        startWith: "$key",
        connectFromField: "key",
        connectToField: "downstream_interfaces",
        as: "chain",
        maxDepth: 20,
      },
    },
  ]);
  if (!result.length) return [];
  return result[0].chain || [];
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
