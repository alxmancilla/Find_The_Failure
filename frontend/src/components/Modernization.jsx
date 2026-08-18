import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Modernization() {
  const [systems, setSystems] = useState([]);
  const [systemKey, setSystemKey] = useState("x12-translator");
  const [result, setResult] = useState(null);

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
          </>
        )}
      </div>
    </div>
  );
}
