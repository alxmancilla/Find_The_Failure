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

export default function DependencyGraph({ flow, impacted, onSelectSystem, onSelectInterface }) {
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
      const failed = failedEdges.has(e.id);
      const risk = riskEdges.has(e.id);
      const color = failed ? "#ff5470" : risk ? "#ffb020" : "#4b5680";
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: `${e.data.label} (${e.data.protocol})`,
        animated: failed || risk,
        style: { stroke: color, strokeWidth: failed || risk ? 2.5 : 1.5 },
        labelStyle: { fill: "#9aa4c0", fontSize: 10 },
        labelBgStyle: { fill: "#141a2e" },
        markerEnd: { type: MarkerType.ArrowClosed, color },
      };
    });
    return { rfNodes, rfEdges };
  }, [flow, impacted]);

  if (!flow) return <div className="empty">Search and select an interface to see its dependency path.</div>;

  return (
    <div className="graph-wrap">
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
    </div>
  );
}
