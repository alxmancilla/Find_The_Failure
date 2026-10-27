import { useEffect, useMemo, useState } from "react";
import DependencyGraph from "./DependencyGraph.jsx";
import { MappingVersion, OrderTrace, StandardsPanel, StewardDecisions, StewardReview } from "./LineageGovernance.jsx";
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

function EntityPanel({ entity, onPlanChange }) {
  if (!entity) return null;
  const sor = entity.system_of_record;
  return (
    <section className="panel-section">
      <h3>{entity.name}</h3>
      <p className="muted mini-copy">{entity.description}</p>
      <div className="kv"><span className="k">System of record</span><span className="v">{entity.system_of_record?.name || "None (transient)"}</span></div>
      <div className="kv"><span className="k">Data owner</span><span className="v">{entity.data_owner?.name || "—"}</span></div>
      <div className="kv"><span className="k">Produced by</span><span className="v">{names(entity.produced_by)}</span></div>
      <div className="kv"><span className="k">Consumed by</span><span className="v">{names(entity.consumed_by)}</span></div>
      <div className="kv"><span className="k">Carried by</span><span className="v">{names(entity.carried_by)}</span></div>
      <div className="kv"><span className="k">Identifiers</span><span className="v">{(entity.identifiers || []).join(", ") || "—"}</span></div>
      {sor && onPlanChange && (
        <button type="button" className="full lineage-plan-change" onClick={() => onPlanChange(sor.key)}>Plan a change to {sor.name} →</button>
      )}
    </section>
  );
}

function TransformationPanel({ transformation, entityName, identifier = "po_number", onReviewed }) {
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
      {transformation.via?.length > 0 && <div className="kv"><span className="k">Via</span><span className="v">{names(transformation.via)} · translation steps collapsed</span></div>}
      <div className="kv"><span className="k">Interface owner</span><span className="v">{names(transformation.owners)}</span></div>
      <MappingVersion transformation={transformation} />
      {transformation.field_mappings.length > 0 && (
        <table className="mapping-table">
          <thead><tr><th>Field</th><th>Source</th><th>Target</th></tr></thead>
          <tbody>
            {transformation.field_mappings.map((m) => (
              <tr key={m.field} className={m.field === identifier ? "highlight" : ""}><td>{m.field}</td><td>{m.source_path}</td><td>{m.target_path}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {transformation.evidence.map((item) => <div key={item} className="evidence">{item}</div>)}
      <div className="kv"><span className="k">Source record</span><span className="v">{transformation.source_record_id || "—"}</span></div>
      <StewardReview transformation={transformation} onReviewed={onReviewed} />
    </section>
  );
}

export default function LineageView({ lens, onLensChange, onPlanChange }) {
  const [flows, setFlows] = useState([]);
  const [flowKey, setFlowKey] = useState("order-to-cash");
  const [entities, setEntities] = useState([]);
  const [entityKey, setEntityKey] = useState("purchase-order");
  const [direction, setDirection] = useState("both");
  const [lineage, setLineage] = useState(null);
  const [flow, setFlow] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [asOf, setAsOf] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  const refresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    api.lineageFlows().then((res) => setFlows(res.flows || [])).catch(() => setFlows([]));
  }, []);

  useEffect(() => {
    let ignore = false;
    setFlow(null);
    api.lineageEntities(flowKey)
      .then((res) => {
        if (ignore) return;
        const list = res.entities || [];
        setEntities(list);
        setEntityKey((current) => (list.some((e) => e.key === current) ? current : list[0]?.key || ""));
      })
      .catch(() => setError("Unable to load lineage entities."));
    api.lineageFlow(flowKey).then((res) => { if (!ignore) setFlow(res); }).catch(() => {});
    return () => { ignore = true; };
  }, [flowKey]);

  useEffect(() => setSelectedEdge(null), [entityKey, direction, flowKey]);

  useEffect(() => {
    if (!entityKey || !entities.some((e) => e.key === entityKey)) return undefined;
    let ignore = false;
    api.lineage(entityKey, direction, asOf, flowKey)
      .then((res) => { if (!ignore) { setLineage(res); setError(""); } })
      .catch(() => { if (!ignore) setError("Unable to load lineage."); });
    return () => { ignore = true; };
  }, [entityKey, entities, direction, asOf, flowKey, refreshKey]);

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
          {flows.length > 1 && (
            <div className="lineage-entity-row" aria-label="Lineage flow">
              <span className="muted mini-copy">Flow</span>
              {flows.map((f) => (
                <button key={f.key} type="button" className={f.key === flowKey ? "active" : ""} onClick={() => setFlowKey(f.key)}>{f.name}</button>
              ))}
            </div>
          )}
          <div className="lineage-entity-row" aria-label="Flow data entities">
            {entities.map((e) => (
              <button key={e.key} type="button" className={e.key === entityKey ? "active" : ""} onClick={() => setEntityKey(e.key)}>{e.name}</button>
            ))}
          </div>
          <div className="lineage-direction-row" aria-label="Lineage direction">
            {DIRECTIONS.map((d) => (
              <button key={d.id} type="button" className={d.id === direction ? "active" : ""} onClick={() => setDirection(d.id)}>{d.label}</button>
            ))}
            <label className="lineage-as-of">
              <span>As of</span>
              <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
              {asOf && <button type="button" onClick={() => setAsOf("")}>Current</button>}
            </label>
            <span className="muted mini-copy">Amber animated edges are inferred and need data steward review.</span>
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
        <EntityPanel entity={lineage?.entity} onPlanChange={onPlanChange} />
        <TransformationPanel transformation={transformation} entityName={entityName} identifier={flow?.identifier} onReviewed={refresh} />
        <StewardDecisions refreshKey={refreshKey} onReset={refresh} />
        <OrderTrace flow={flow} />
        <StandardsPanel flowKey={flow?.flow} />
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
