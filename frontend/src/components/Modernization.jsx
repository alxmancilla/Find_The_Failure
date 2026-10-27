import { useEffect, useState } from "react";
import { api } from "../api.js";

const entityChips = (list, className = "chip") => (
  list.length ? list.map((e) => <span key={e.key} className={className}>{e.name}</span>) : <span className="muted">None</span>
);

function LineageImpact({ impact, sysName }) {
  const s = impact.summary;
  return (
    <div className="panel-section lineage-impact">
      <h3>Data Lineage Impact (all flows)</h3>
      <p className="muted mini-copy">
        Replacing {sysName} means re-implementing {s.transformation_count} transformation{s.transformation_count === 1 ? "" : "s"} and {s.field_mapping_count} field mapping{s.field_mapping_count === 1 ? "" : "s"}, and re-testing {s.translation_hop_count} middleware translation hop{s.translation_hop_count === 1 ? "" : "s"}.
      </p>
      <div className="mod-summary">
        <div className="stat"><div className="num">{s.transformation_count}</div><div className="lbl">Transformations</div></div>
        <div className="stat"><div className="num">{s.field_mapping_count}</div><div className="lbl">Field mappings</div></div>
        <div className="stat"><div className="num">{s.dependent_count}</div><div className="lbl">Dependent entities</div></div>
      </div>
      {impact.transformations.map((t) => (
        <div key={t.key} className="event">
          <div><strong>{t.from_key} → {t.to_key}</strong> {t.flow && <span className="badge">{t.flow}</span>} {t.interface && <span className="badge">{t.interface.protocol} {t.interface.message_type}</span>} {!t.confirmed && <span className="badge status-degraded">inferred</span>}</div>
          <div className="when">{t.transformation}</div>
          {t.field_mappings.length > 0 && <div className="when">{t.field_mappings.map((m) => `${m.field}: ${m.source_path} → ${m.target_path}`).join(" · ")}</div>}
        </div>
      ))}
      <div className="kv"><span className="k">Produces</span><span className="v chip-row">{entityChips(impact.produced_entities)}</span></div>
      <div className="kv"><span className="k">System of record for</span><span className="v chip-row">{entityChips(impact.mastered_entities)}</span></div>
      <div className="kv"><span className="k">Downstream entities depending on it</span><span className="v chip-row">{entityChips(impact.dependent_entities, "chip risk")}</span></div>
      {impact.translation_hops.length > 0 && (
        <div className="kv"><span className="k">Middleware translation hops</span><span className="v">{impact.translation_hops.map((i) => i.name).join(", ")}</span></div>
      )}
    </div>
  );
}

export default function Modernization({ systemKey: initialSystemKey = "x12-translator", onSystemChange }) {
  const [systems, setSystems] = useState([]);
  const [systemKey, setSystemKeyState] = useState(initialSystemKey);
  const [result, setResult] = useState(null);
  const setSystemKey = (key) => {
    setSystemKeyState(key);
    onSystemChange?.(key);
  };

  useEffect(() => {
    api.systems().then(setSystems);
  }, []);

  const run = async () => setResult(await api.modernization(systemKey));

  useEffect(() => {
    run();
  }, [systemKey]);

  const sysName = systems.find((s) => s.key === systemKey)?.name || systemKey;

  return (
    <div className="main">
      <div className="left" style={{ padding: 24, overflowY: "auto" }}>
        <h2 style={{ marginTop: 0 }}>Modernization Impact</h2>
        <p className="muted">
          Ask: “What would be impacted if we replaced a component?” MongoDB
          traverses the metadata to return every affected interface, owner, and
          downstream system in one query.
        </p>

        <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "16px 0" }}>
          <span>What if we replace</span>
          <select value={systemKey} onChange={(e) => setSystemKey(e.target.value)}>
            {systems.map((s) => (
              <option key={s.key} value={s.key}>{s.name}</option>
            ))}
          </select>
          <button className="primary" onClick={run}>Analyze</button>
        </div>

        {result && (
          <>
            <div className="mod-summary">
              <div className="stat">
                <div className="num">{result.summary.interface_count}</div>
                <div className="lbl">Interfaces</div>
              </div>
              <div className="stat">
                <div className="num">{result.summary.owner_count}</div>
                <div className="lbl">Owners</div>
              </div>
              <div className="stat">
                <div className="num">{result.summary.downstream_count}</div>
                <div className="lbl">Downstream systems</div>
              </div>
            </div>

            <div className="panel-section">
              <h3>Affected Interfaces</h3>
              {result.affected_interfaces.length === 0 && (
                <span className="muted">Nothing depends on {sysName}.</span>
              )}
              {result.affected_interfaces.map((i) => (
                <div key={i.key} className="event">
                  <div>
                    <strong>{i.name}</strong>{" "}
                    <span className="badge">{i.protocol}</span>{" "}
                    <span className="badge">{i.lifecycle}</span>
                  </div>
                  <div className="when">{i.source} → {i.target} · {i.message_type}</div>
                </div>
              ))}
            </div>

            <div className="panel-section">
              <h3>Owners to Coordinate</h3>
              <div className="chip-row">
                {result.owners.map((o) => <span key={o.key} className="chip">{o.name}</span>)}
              </div>
            </div>

            <div className="panel-section">
              <h3>Migration Dependencies (downstream)</h3>
              <div className="chip-row">
                {result.downstream_systems.map((s) => (
                  <span key={s.key} className="chip risk">{s.name}</span>
                ))}
              </div>
            </div>

            {result.lineage_impact && <LineageImpact impact={result.lineage_impact} sysName={sysName} />}
          </>
        )}
      </div>
    </div>
  );
}
