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

function PipelineStep({ step, index }) {
  return (
    <div className="pipeline-step">
      <span>{index + 1}</span>
      <div>
        <strong>{step.label}</strong>
        <p>{step.detail}</p>
      </div>
      <b>{step.value}</b>
    </div>
  );
}

function ActionMessage({ result, error }) {
  if (error) return <div className="event error">{error}</div>;
  if (!result) return null;
  if (result.source_records_loaded) {
    return <div className="event success">Captured {result.source_records_loaded} enterprise fixture records from observability, catalog, and CMDB exports.</div>;
  }
  if (result.deleted_source_records !== undefined) {
    return <div className="event success">Cleared fixture pack: {result.deleted_source_records} source records, {result.deleted_relationships} relationships, {result.deleted_events} events.</div>;
  }
  return (
    <div className="event success">
      Ingested {result.source_records} source records · {result.relationship_upserts} relationships · {result.event_upserts} events
    </div>
  );
}

const fmtDate = (value) => value ? new Date(value).toLocaleString() : "not observed";

export default function Ingestion() {
  const [dashboard, setDashboard] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => setDashboard(await api.ingestion());

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const doAction = async (action) => {
    setBusy(true);
    setError("");
    try {
      const res = await action();
      setResult(res);
      await load();
    } catch (err) {
      setError(err.message || "Ingestion action failed.");
    } finally {
      setBusy(false);
    }
  };

  const records = dashboard?.source_records || [];
  const quality = dashboard?.quality;
  const bySource = Object.entries(dashboard?.summary?.by_source || {});
  const byType = Object.entries(dashboard?.summary?.by_type || {});
  const score = quality?.scorecard;

  return (
    <div className="main">
      <div className="left page">
        <h2>Enterprise Context Ingestion</h2>
        <p className="muted">
          Replay realistic observability, integration-catalog, and CMDB exports. MongoDB captures
          raw source records, resolves aliases, normalizes graph/event context, and exposes trust signals.
        </p>

        <div className="sim-controls">
          <button disabled={busy} onClick={() => doAction(api.loadEnterpriseFixtures)}>
            Load enterprise fixture pack
          </button>
          <button className="primary" disabled={busy} onClick={() => doAction(api.runIngestion)}>
            Normalize source records
          </button>
          <button className="danger" disabled={busy} onClick={() => doAction(api.clearEnterpriseFixtures)}>
            Clear fixture pack
          </button>
          <button disabled={busy} onClick={load}>Refresh</button>
        </div>

        <ActionMessage result={result} error={error} />

        <div className="mod-summary">
          <Stat label="Source records" value={quality?.source_record_count ?? records.length} />
          <Stat label="Trust score" value={score?.trust_score ? `${score.trust_score}%` : "—"} />
          <Stat label="Provenance" value={quality?.provenance_coverage !== undefined ? `${quality.provenance_coverage}%` : "—"} />
          <Stat label="Pending" value={quality?.pending_records ?? "—"} />
        </div>

        {dashboard?.pipeline && (
          <section className="panel-card">
            <h3>Ingestion Pipeline</h3>
            <div className="ingestion-pipeline">
              {dashboard.pipeline.map((step, index) => <PipelineStep key={step.label} step={step} index={index} />)}
            </div>
          </section>
        )}

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
              <h3>Source Coverage</h3>
              {bySource.map(([source, count]) => (
                <div key={source} className="kv"><span className="k">{source}</span><span>{count}</span></div>
              ))}
              {byType.map(([type, count]) => (
                <div key={type} className="kv"><span className="k">{type} records</span><span>{count}</span></div>
              ))}
              {score && <div className="quality-note">{score.stewardship_items} stewardship items · {quality.fixture_records} fixture records loaded</div>}
            </section>
          </div>
        )}

        <section className="panel-card">
          <h3>Raw Source Records</h3>
          {records.map((r) => (
            <div key={r.key} className="source-record">
              <div className="source-record-head">
                <strong>{r.external_id}</strong>
                <span className="badge">{r.record_type}</span>
                <span className={`badge status-${r.ingestion_status}`}>{r.ingestion_status}</span>
              </div>
              <div className="when">{r.source_system} · {r.entity_type}:{r.entity_key} · observed {fmtDate(r.observed_at)}</div>
              {r.entity_resolution && <div className="record-meta">Alias {r.entity_resolution.alias} → {r.entity_resolution.canonical_key || "unresolved"} · {r.entity_resolution.matched_by}</div>}
              {r.provenance && <div className="record-meta">{r.provenance.adapter} · trust: {r.provenance.trust_level} · source id: {r.provenance.source_id}</div>}
              <div className="muted">{r.evidence?.[0]}</div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}