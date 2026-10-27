import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";

// Layered left-to-right layout: x by depth from roots, y stacked per depth.
function layout(nodes, edges) {
  const incoming = {};
  const adj = {};
  nodes.forEach((n) => ((incoming[n.id] = 0), (adj[n.id] = [])));
  edges.forEach((e) => {
    if (adj[e.source]) adj[e.source].push(e.target);
    if (e.target in incoming) incoming[e.target]++;
  });
  const depth = {};
  const queue = nodes.filter((n) => incoming[n.id] === 0).map((n) => n.id);
  queue.forEach((id) => (depth[id] = 0));
  while (queue.length) {
    const id = queue.shift();
    for (const nb of adj[id]) {
      const d = depth[id] + 1;
      if (depth[nb] === undefined || d > depth[nb]) {
        depth[nb] = d;
        queue.push(nb);
      }
    }
  }
  const perDepth = {};
  return nodes.map((n) => {
    const d = depth[n.id] ?? 0;
    perDepth[d] = (perDepth[d] || 0) + 1;
    return { id: n.id, depth: d, row: perDepth[d] - 1 };
  });
}

function SystemNode({ data }) {
  return (
    <div className={`rf-node ${data.statusClass || ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="kind">{data.kind}</div>
      <div className="name">{data.label}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { system: SystemNode };

const EDGE_STYLE = {
  ok: { color: "#4b5680", icon: "" },
  risk: { color: "#ffb020", icon: "⚠ " },
  failed: { color: "#ff5470", icon: "✕ " },
};

export const IMPACT_LEGEND = [
  { kind: "ok", label: "Healthy" },
  { kind: "risk", label: "At risk (downstream)" },
  { kind: "failed", label: "Failed" },
];

function Legend({ items }) {
  return (
    <ul className="graph-legend" aria-label="Graph legend">
      {items.map((item) => (
        <li key={item.kind}>
          <span className={`graph-legend-line ${item.kind}`} aria-hidden="true" />
          {EDGE_STYLE[item.kind].icon}{item.label}
        </li>
      ))}
    </ul>
  );
}

export default function DependencyGraph({ flow, impacted, selectedId, emptyText, legend = IMPACT_LEGEND, loading = false, onSelectSystem, onSelectInterface }) {
  const { rfNodes, rfEdges } = useMemo(() => {
    if (!flow) return { rfNodes: [], rfEdges: [] };
    const pos = Object.fromEntries(layout(flow.nodes, flow.edges).map((p) => [p.id, p]));
    const failedSystems = new Set(impacted?.failedSystems || []);
    const riskSystems = new Set(impacted?.riskSystems || []);
    const rootId = flow.edges[0]?.source;

    const rfNodes = flow.nodes.map((n) => {
      const p = pos[n.id] || { depth: 0, row: 0 };
      let statusClass = n.id === rootId ? "source" : "";
      if (riskSystems.has(n.id)) statusClass = "at-risk";
      if (failedSystems.has(n.id)) statusClass = "failed";
      if (selectedId && n.id === selectedId) statusClass = `${statusClass} selected`;
      return {
        id: n.id,
        type: "system",
        position: { x: p.depth * 240, y: p.row * 110 },
        data: { ...n.data, statusClass },
      };
    });

    const failedEdges = new Set(impacted?.failedEdges || []);
    const riskEdges = new Set(impacted?.riskEdges || []);
    const rfEdges = flow.edges.map((e) => {
      const kind = failedEdges.has(e.id) ? "failed" : riskEdges.has(e.id) ? "risk" : "ok";
      const { color, icon } = EDGE_STYLE[kind];
      const flagged = kind !== "ok";
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: `${icon}${e.data.label} (${e.data.protocol})`,
        animated: flagged,
        style: { stroke: color, strokeWidth: flagged ? 2.5 : 1.5, strokeDasharray: kind === "risk" ? "6 4" : undefined },
        labelStyle: { fill: flagged ? color : "#9aa4c0", fontSize: 12 },
        labelBgStyle: { fill: "#141a2e" },
        markerEnd: { type: MarkerType.ArrowClosed, color },
      };
    });
    return { rfNodes, rfEdges };
  }, [flow, impacted, selectedId]);

  if (!flow) return <div className="empty" aria-busy={loading}>{emptyText || "Search and select an interface to see its dependency path."}</div>;

  return (
    <div className={`graph-wrap ${loading ? "is-loading" : ""}`} aria-busy={loading}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        fitView
        onNodeClick={(_e, n) => onSelectSystem?.(n.id)}
        onEdgeClick={(_e, ed) => onSelectInterface?.(ed.id)}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#2a3350" gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
      {legend?.length > 0 && <Legend items={legend} />}
      {loading && <div className="graph-loading" role="status">Loading…</div>}
    </div>
  );
}
