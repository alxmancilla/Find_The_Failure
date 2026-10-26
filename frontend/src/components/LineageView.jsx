import { useEffect, useMemo, useState } from "react";
import DependencyGraph from "./DependencyGraph.jsx";
import { api } from "../api.js";

const DIRECTIONS = [
  { id: "both", label: "Both" },
  { id: "upstream", label: "Upstream" },
  { id: "downstream", label: "Downstream" },
];

export function LensToggle({ lens, onChange }) {
  return (
    <div className="lens-toggle" role="group" aria-label="Catalog lens">
      <button type="button" className={lens === "system" ? "active" : ""} aria-pressed={lens === "system"} onClick={() => onChange("system")}>System view</button>
      <button type="button" className={lens === "data" ? "active" : ""} aria-pressed={lens === "data"} onClick={() => onChange("data")}>Data view</button>
      <span className="muted">{lens === "data" ? "Operational lineage · order-to-cash" : "Interfaces and dependency paths"}</span>
    </div>
  );
}

const names = (items) => (items || []).map((item) => item.name || item.key).join(", ") || "—";

function EntityPanel({ entity }) {
  if (!entity) return null;
  return (
    <section className="panel-section">
      <h3>{entity.name}</h3>
      <p className="muted mini-copy">{entity.description}</p>
      <div className="kv"><span className="k">System of record</span><span className="v">{entity.system_of_record?.name || "None (transient)"}</span></div>
      <div className="kv"><span className="k">Produced by</span><span className="v">{names(entity.produced_by)}</span></div>
      <div className="kv"><span className="k">Consumed by</span><span className="v">{names(entity.consumed_by)}</span></div>
      <div className="kv"><span className="k">Carried by</span><span className="v">{names(entity.carried_by)}</span></div>
      <div className="kv"><span className="k">Identifiers</span><span className="v">{(entity.identifiers || []).join(", ") || "—"}</span></div>
    </section>
  );
}

function TransformationPanel({ transformation, entityName }) {
  if (!transformation) return <p className="muted mini-copy">Click a lineage edge to see the transformation, field mappings, owner, and evidence.</p>;
  return (
    <section className="panel-section lineage-hop">
      <h3>{entityName(transformation.from_key)} → {entityName(transformation.to_key)}</h3>
      <span className={`trust-pill ${transformation.confirmed ? "confirmed" : "inferred"}`}>
        {transformation.confirmed ? "Confirmed" : "Inferred"} · {Math.round(transformation.confidence * 100)}% · {transformation.source_system}
      </span>
      <p className="mini-copy">{transformation.transformation}</p>
      <div className="kv"><span className="k">Interface</span><span className="v">{transformation.interface ? `${transformation.interface.name} (${transformation.interface.protocol} ${transformation.interface.message_type})` : "Not mapped to an interface"}</span></div>
      <div className="kv"><span className="k">Transformed by</span><span className="v">{transformation.transformed_by?.name || "—"}</span></div>
      <div className="kv"><span className="k">Owner</span><span className="v">{names(transformation.owners)}</span></div>
      {transformation.field_mappings.length > 0 && (
        <table className="mapping-table">
          <thead><tr><th>Field</th><th>Source</th><th>Target</th></tr></thead>
          <tbody>
            {transformation.field_mappings.map((m) => (
              <tr key={m.field} className={m.field === "po_number" ? "highlight" : ""}><td>{m.field}</td><td>{m.source_path}</td><td>{m.target_path}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {transformation.evidence.map((item) => <div key={item} className="evidence">{item}</div>)}
    </section>
  );
}

function PoNumberTrace({ flow }) {
  if (!flow) return null;
  return (
    <details className="detail-stack lineage-trace">
      <summary>Follow the PO number <span>{flow.steps.length} hops</span></summary>
      <p className="muted mini-copy lineage-trace-copy">{flow.summary}</p>
      <ol className="po-trace">
        {flow.steps.map((step) => (
          <li key={step.interface.key} className={step.changes_shape ? "changes" : ""}>
            <strong>{step.step}. {step.interface.name}</strong>
            <small>{step.from_system.name} → {step.to_system.name}{step.changes_shape ? ` · ${step.input_entity?.name} → ${step.output_entity?.name}` : ""}</small>
            <code>{step.po_number_mapping?.target_path || "—"}</code>
          </li>
        ))}
      </ol>
    </details>
  );
}

export default function LineageView({ lens, onLensChange }) {
  const [entities, setEntities] = useState([]);
  const [entityKey, setEntityKey] = useState("purchase-order");
  const [direction, setDirection] = useState("both");
  const [lineage, setLineage] = useState(null);
  const [flow, setFlow] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.lineageEntities().then((res) => setEntities(res.entities || [])).catch(() => setError("Unable to load lineage entities."));
    api.lineageFlow().then(setFlow).catch(() => {});
  }, []);

  useEffect(() => {
    let ignore = false;
    setSelectedEdge(null);
    api.lineage(entityKey, direction)
      .then((res) => { if (!ignore) { setLineage(res); setError(""); } })
      .catch(() => { if (!ignore) setError("Unable to load lineage."); });
    return () => { ignore = true; };
  }, [entityKey, direction]);

  const impacted = useMemo(() => ({
    riskEdges: (lineage?.transformations || []).filter((t) => !t.confirmed).map((t) => t.key),
  }), [lineage]);
  const entityName = (key) => lineage?.entities.find((e) => e.key === key)?.name || key;
  const transformation = lineage?.transformations.find((t) => t.key === selectedEdge);

  return (
    <div className="main">
      <div className="left">
        <LensToggle lens={lens} onChange={onLensChange} />
        <div className="lineage-toolbar">
          <div className="lineage-entity-row" aria-label="Order-to-cash data entities">
            {entities.map((e) => (
              <button key={e.key} type="button" className={e.key === entityKey ? "active" : ""} onClick={() => setEntityKey(e.key)}>{e.name}</button>
            ))}
          </div>
          <div className="lineage-direction-row" aria-label="Lineage direction">
            {DIRECTIONS.map((d) => (
              <button key={d.id} type="button" className={d.id === direction ? "active" : ""} onClick={() => setDirection(d.id)}>{d.label}</button>
            ))}
            <span className="muted mini-copy">Amber animated edges are inferred and need SME confirmation.</span>
          </div>
        </div>
        {error && <p className="feed-status">{error}</p>}
        <DependencyGraph
          flow={lineage?.graph?.edges?.length ? lineage.graph : null}
          impacted={impacted}
          selectedId={entityKey}
          emptyText="No transformations found for this entity in the selected direction."
          onSelectSystem={setEntityKey}
          onSelectInterface={setSelectedEdge}
        />
      </div>
      <aside className="right">
        {lineage && (
          <section className="panel-section">
            <h3>Operational lineage</h3>
            <p className="mini-copy">{lineage.summary}</p>
            <div className="chip-row">
              <span className="chip">{lineage.data_quality.confirmed} confirmed</span>
              {lineage.data_quality.inferred > 0 && <span className="chip risk">{lineage.data_quality.inferred} inferred</span>}
              <span className="chip">avg confidence {Math.round((lineage.data_quality.average_confidence || 0) * 100)}%</span>
            </div>
          </section>
        )}
        <EntityPanel entity={lineage?.entity} />
        <TransformationPanel transformation={transformation} entityName={entityName} />
        <PoNumberTrace flow={flow} />
        {lineage?.mongodb_trace && (
          <details className="detail-stack">
            <summary>MongoDB proof <span>$graphLookup</span></summary>
            <p className="muted mini-copy lineage-trace-copy">{lineage.mongodb_trace.purpose}</p>
            <pre className="lineage-pipeline">{`db.${lineage.mongodb_trace.collection}.aggregate(${JSON.stringify(lineage.mongodb_trace.pipeline, null, 2)})`}</pre>
          </details>
        )}
      </aside>
    </div>
  );
}
