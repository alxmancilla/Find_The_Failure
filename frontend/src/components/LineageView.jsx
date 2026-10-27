import { useEffect, useMemo, useState } from "react";
import DependencyGraph from "./DependencyGraph.jsx";
import { AsOfBanner, MappingVersion, OrderTrace, Segmented, StandardsPanel, StewardDecisions, StewardReview } from "./LineageGovernance.jsx";
import { api } from "../api.js";

const DIRECTIONS = [
  { id: "upstream", label: "↑ Upstream" },
  { id: "both", label: "↕ Both" },
  { id: "downstream", label: "↓ Downstream" },
];

const LINEAGE_LEGEND = [
  { kind: "ok", label: "Confirmed" },
  { kind: "risk", label: "Inferred · needs steward review" },
];

const PANEL_TABS = [
  { id: "details", label: "Details" },
  { id: "trace", label: "Trace" },
  { id: "governance", label: "Governance" },
  { id: "proof", label: "Proof" },
];

const DIRECTION_WORD = { upstream: "upstream", downstream: "downstream", both: "connected" };

function AnswerLine({ lineage, flow, direction }) {
  if (!lineage?.entity) return null;
  const related = lineage.entities.filter((e) => e.key !== lineage.entity.key).length;
  const { confirmed, inferred } = lineage.data_quality;
  const mapped = flow?.steps.filter((s) => s.identifier_mapping).length;
  return (
    <div className="answer-line" title={lineage.summary}>
      <span><strong>{lineage.entity.name}</strong> · {related} {DIRECTION_WORD[direction]} document{related === 1 ? "" : "s"}</span>
      <span className="chip ok">✓ {confirmed} confirmed</span>
      {inferred > 0 && <span className="chip risk">⚠ {inferred} inferred · needs review</span>}
      {flow && <span className="chip">{flow.identifier_label} on {mapped}/{flow.steps.length} hops</span>}
    </div>
  );
}

export function LensToggle({ lens, onChange }) {
  return (
    <div className="lens-toggle" role="group" aria-label="Catalog lens">
      <button type="button" className={lens === "system" ? "active" : ""} aria-pressed={lens === "system"} onClick={() => onChange("system")}>System view</button>
      <button type="button" className={lens === "data" ? "active" : ""} aria-pressed={lens === "data"} onClick={() => onChange("data")}>Data view</button>
      <span className="muted">{lens === "data" ? "Operational lineage by business flow" : "Interfaces and dependency paths"}</span>
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
  const [panelTab, setPanelTab] = useState("details");
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
  const inferredCount = lineage?.data_quality?.inferred || 0;
  const selectEdge = (edgeKey) => {
    setSelectedEdge(edgeKey);
    setPanelTab("details");
  };

  return (
    <div className="main">
      <div className="left">
        <LensToggle lens={lens} onChange={onLensChange} />
        <div className="lineage-toolbar lineage-controls">
          {flows.length > 1 && (
            <Segmented label="Flow" options={flows.map((f) => ({ id: f.key, label: f.name }))} value={flowKey} onChange={setFlowKey} />
          )}
          <label>
            <span className="control-label">Data entity</span>
            <select value={entityKey} onChange={(e) => setEntityKey(e.target.value)}>
              {entities.map((e, i) => <option key={e.key} value={e.key}>{i + 1}. {e.name}</option>)}
            </select>
          </label>
          <Segmented label="Direction" options={DIRECTIONS} value={direction} onChange={setDirection} />
          <label className="lineage-as-of">
            <span className="control-label">Mappings as of</span>
            <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </label>
        </div>
        <AnswerLine lineage={lineage} flow={flow} direction={direction} />
        <AsOfBanner asOf={asOf} onClear={() => setAsOf("")} />
        {error && <p className="feed-status">{error}</p>}
        <DependencyGraph
          flow={lineage?.graph?.edges?.length ? lineage.graph : null}
          impacted={impacted}
          selectedId={entityKey}
          legend={LINEAGE_LEGEND}
          emptyText="No transformations found for this entity in the selected direction."
          onSelectSystem={setEntityKey}
          onSelectInterface={selectEdge}
        />
      </div>
      <aside className="right">
        <div className="panel-tabs" role="tablist" aria-label="Lineage details">
          {PANEL_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`lineage-tab-${t.id}`}
              aria-selected={panelTab === t.id}
              aria-controls={`lineage-panel-${t.id}`}
              onClick={() => setPanelTab(t.id)}
            >
              {t.label}
              {t.id === "governance" && inferredCount > 0 && <span className="tab-count" aria-label={`${inferredCount} inferred`}>{inferredCount}</span>}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`lineage-panel-${panelTab}`} aria-labelledby={`lineage-tab-${panelTab}`}>
          {panelTab === "details" && (
            <>
              <EntityPanel entity={lineage?.entity} onPlanChange={onPlanChange} />
              <TransformationPanel transformation={transformation} entityName={entityName} identifier={flow?.identifier} onReviewed={refresh} />
            </>
          )}
          {panelTab === "trace" && <OrderTrace flow={flow} defaultOpen />}
          {panelTab === "governance" && (
            <>
              {inferredCount > 0 && (
                <p className="muted mini-copy lineage-trace-copy">
                  {inferredCount} inferred edge{inferredCount === 1 ? "" : "s"} (dashed amber in the graph). Click one to confirm or reject it.
                </p>
              )}
              <StewardDecisions refreshKey={refreshKey} onReset={refresh} />
              <StandardsPanel flowKey={flow?.flow} />
            </>
          )}
          {panelTab === "proof" && lineage?.mongodb_trace && (
            <section className="panel-section">
              <h3>MongoDB proof · $graphLookup</h3>
              <p className="muted mini-copy">{lineage.mongodb_trace.purpose}</p>
              <pre className="lineage-pipeline">{`db.${lineage.mongodb_trace.collection}.aggregate(${JSON.stringify(lineage.mongodb_trace.pipeline, null, 2)})`}</pre>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
