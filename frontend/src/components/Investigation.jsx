import { useEffect, useState } from "react";
import { api } from "../api.js";

const pct = (n) => `${Math.round((n || 0) * 100)}%`;

export default function Investigation() {
  const [alerts, setAlerts] = useState([]);
  const [selected, setSelected] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.alerts().then((res) => {
      setAlerts(res.alerts || []);
      setSelected(res.alerts?.[0]?.key || "");
    }).catch(() => {});
  }, []);

  const investigate = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      setResult(await api.investigation(selected));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (selected) investigate();
  }, [selected]);

  return (
    <div className="main">
      <div className="left page">
        <h2>Read-only Alert Investigation</h2>
        <p className="muted">
          Given an observability alert, the app correlates it to topology, likely fault domains,
          impacted processes, owners, and supporting evidence without taking remediation actions.
        </p>

        <div className="sim-controls">
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            {alerts.map((a) => <option key={a.key} value={a.key}>{a.reason}</option>)}
          </select>
          <button className="primary" disabled={busy || !selected} onClick={investigate}>
            Investigate
          </button>
        </div>

        {!result && <div className="empty">No alert selected.</div>}
        {result && (
          <>
            <section className="panel-card hero-card">
              <h3>Grounded Summary</h3>
              <p>{result.investigation_summary}</p>
              <div className="when">{result.alert.source_system} · {result.alert.interface_key}</div>
            </section>

            <div className="ingestion-grid">
              <section className="panel-card">
                <h3>Likely Fault Domains</h3>
                {result.likely_fault_domains.map((c) => (
                  <div key={c.key} className="candidate">
                    <div><strong>{c.name}</strong> <span className="badge">{pct(c.score)}</span></div>
                    <div className="muted">{c.reason}</div>
                  </div>
                ))}
              </section>
              <section className="panel-card">
                <h3>Owners / Process Impact</h3>
                <div className="chip-row">
                  {result.owners.map((o) => <span key={o.key} className="chip">{o.name}</span>)}
                  {result.impacted_business_processes.map((p) => <span key={p.key} className="chip risk">{p.name}</span>)}
                </div>
              </section>
            </div>

            <section className="panel-card">
              <h3>Evidence and Next Actions</h3>
              {result.evidence.map((e, i) => <div key={i} className="evidence">{e}</div>)}
              {result.recommended_next_actions.map((a, i) => <div key={i} className="next-action">{a}</div>)}
            </section>
          </>
        )}
      </div>
    </div>
  );
}