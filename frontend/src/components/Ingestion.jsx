import { useEffect, useState } from "react";
import { api } from "../api.js";

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="num">{value}</div>
      <div className="lbl">{label}</div>
    </div>
  );
}

export default function Ingestion() {
  const [dashboard, setDashboard] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => setDashboard(await api.ingestion());

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const run = async () => {
    setBusy(true);
    try {
      const res = await api.runIngestion();
      setResult(res);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const records = dashboard?.source_records || [];
  const quality = dashboard?.quality;
  const bySource = Object.entries(dashboard?.summary?.by_source || {});

  return (
    <div className="main">
      <div className="left page">
        <h2>Federated Metadata Ingestion</h2>
        <p className="muted">
          See how raw records from integration inventory, CMDB, and observability become
          a unified MongoDB context graph with evidence and data-quality signals.
        </p>

        <div className="sim-controls">
          <button className="primary" disabled={busy} onClick={run}>
            Normalize source records
          </button>
          <button disabled={busy} onClick={load}>Refresh</button>
        </div>

        {result && (
          <div className="event success">
            Ingested {result.source_records} source records · {result.relationship_upserts} relationships · {result.event_upserts} events
          </div>
        )}

        <div className="mod-summary">
          <Stat label="Source records" value={quality?.source_record_count ?? records.length} />
          <Stat label="Relationships" value={quality?.relationship_count ?? "—"} />
          <Stat label="Confirmed edges" value={quality?.confirmed_relationships ?? "—"} />
        </div>

        {quality && (
          <div className="ingestion-grid">
            <section className="panel-card">
              <h3>Data Quality Findings</h3>
              {quality.findings.map((f) => (
                <div key={f.label} className={`finding ${f.severity}`}>
                  <span>{f.label}</span><strong>{f.count}</strong>
                </div>
              ))}
            </section>
            <section className="panel-card">
              <h3>Source Systems</h3>
              {bySource.map(([source, count]) => (
                <div key={source} className="kv"><span className="k">{source}</span><span>{count}</span></div>
              ))}
            </section>
          </div>
        )}

        <section className="panel-card">
          <h3>Raw Source Records</h3>
          {records.map((r) => (
            <div key={r.key} className="source-record">
              <div><strong>{r.external_id}</strong> <span className="badge">{r.record_type}</span></div>
              <div className="when">{r.source_system} · {r.entity_type}:{r.entity_key}</div>
              <div className="muted">{r.evidence?.[0]}</div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}