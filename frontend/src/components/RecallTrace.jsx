import { useEffect, useState } from "react";
import { api } from "../api.js";
import { AsOfBanner, ErrorNotice } from "./LineageGovernance.jsx";

const when = (d) => (d ? new Date(d).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }) : "—");

function Stat({ label, value }) {
  return <div className="stat"><div className="num">{value}</div><div className="lbl">{label}</div></div>;
}

function Coverage({ coverage }) {
  return (
    <div className="panel-section">
      <h3>Lot number coverage {coverage.as_of ? `(as of ${coverage.as_of})` : "(current mappings)"}</h3>
      {coverage.flows.map((f) => (
        <div key={f.flow} className="recall-coverage-flow">
          <strong>{f.name}</strong> <span className="muted mini-copy">{f.mapped_hops} of {f.hops.length} hops carry the lot</span>
          <div className="recall-coverage-row">
            {f.hops.map((h) => (
              <span key={h.interface?.key} className={`recall-hop ${h.mapped ? "mapped" : ""}`} title={h.mapping ? `${h.mapping.source_path} → ${h.mapping.target_path}` : "Lot not mapped"}>
                <span aria-label={h.mapped ? "carries the lot" : "lot not mapped"}>{h.mapped ? "✓ " : "— "}</span>{h.interface?.name} <small>{h.mapping_version}{h.mapping_standard ? ` · ${h.mapping_standard}` : ""}</small>
              </span>
            ))}
          </div>
        </div>
      ))}
      {coverage.internal_steps.length > 0 && (
        <p className="muted mini-copy">Internal steps carrying the lot: {coverage.internal_steps.map((s) => `${s.from_key} → ${s.to_key}`).join(" · ")}</p>
      )}
    </div>
  );
}

function RecallAnswer({ recall, trace, untraceable }) {
  const hospitals = trace.customers.map((c) => c.ship_to);
  const untraceableUnits = untraceable.reduce((sum, r) => sum + (r.quantity || 0), 0);
  return (
    <p className="recall-answer" role="status">
      Lot <strong>{recall.lot_number}</strong> ({recall.product}) reached <strong>{hospitals.length} hospital{hospitals.length === 1 ? "" : "s"}</strong>
      {hospitals.length ? `: ${hospitals.join(", ")}` : ""}. <strong>{trace.totals.on_hand} units</strong> are still on hand.
      {untraceable.length > 0 && (
        <span className="warn"> ⚠ {untraceable.length} receipt{untraceable.length === 1 ? "" : "s"} ({untraceableUnits} units) cannot be traced by lot.</span>
      )}
    </p>
  );
}

// Entity to open in the Data view when following a transaction from the recall trace.
const FLOW_ENTITY = { "order-to-cash": "advance-ship-notice", "procure-to-pay": "goods-receipt" };

function TraceLink({ flow, value, onOpenLineage }) {
  if (!onOpenLineage) return value;
  return (
    <button type="button" className="link-button" title={`Open ${value} in the Data view`} onClick={() => onOpenLineage({ flow, entity: FLOW_ENTITY[flow], transaction: value })}>
      {value}
    </button>
  );
}

const joinNodes = (nodes) => nodes.flatMap((node, i) => (i ? [", ", node] : [node]));

export default function RecallTrace({ onOpenLineage }) {
  const [recalls, setRecalls] = useState([]);
  const [recallId, setRecallId] = useState("");
  const [asOf, setAsOf] = useState("");
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState("");
  const retry = () => {
    setError("");
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    api.recalls().then((res) => {
      setRecalls(res.recalls || []);
      setRecallId((current) => current || res.recalls?.[0]?.key || "");
      if (!res.recalls?.length) setLoading(false);
    }).catch(() => { setError("Unable to load recall notices."); setLoading(false); });
  }, [reloadKey]);

  useEffect(() => {
    if (!recallId) return undefined;
    let ignore = false;
    setLoading(true);
    api.recall(recallId, asOf)
      .then((res) => { if (!ignore) { setDetail(res); setError(""); } })
      .catch(() => { if (!ignore) setError("Unable to load recall trace."); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [recallId, asOf, reloadKey]);

  const recall = detail?.recall;
  const trace = detail?.trace;
  const link = (flow, value) => <TraceLink key={value} flow={flow} value={value} onOpenLineage={onOpenLineage} />;
  return (
    <div className="main">
      <div className="left" style={{ padding: 24, overflowY: "auto" }}>
        <h2 style={{ marginTop: 0 }}>Recall Trace</h2>
        <p className="muted">
          Trace a recalled lot across procure-to-pay and order-to-cash: which receipt brought it in, how much is on
          hand, and which hospitals received it. Sample data; actions are read-only.
        </p>
        <div className="recall-toolbar">
          <label>
            <span>Recall notice</span>
            <select value={recallId} onChange={(e) => setRecallId(e.target.value)}>
              {recalls.map((r) => <option key={r.key} value={r.key}>{r.key} · {r.product} · lot {r.lot_number}</option>)}
            </select>
          </label>
          <label className="lineage-as-of">
            <span>Mappings as of</span>
            <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </label>
        </div>
        <AsOfBanner asOf={asOf} onClear={() => setAsOf("")} subject="lot mappings" inset />
        <ErrorNotice message={error} onRetry={retry} />
        {loading && <p className="muted loading-text" role="status">{detail ? "Updating recall trace…" : "Loading recall trace…"}</p>}
        {!loading && !error && !recalls.length && (
          <div className="empty-card"><strong>No recall notices</strong><p>Reseed with <code>npm run seed</code> to load the sample recall notice.</p></div>
        )}
        {recall && trace && (
          <div aria-busy={loading} style={{ opacity: loading ? 0.6 : 1 }}>
            <RecallAnswer recall={recall} trace={trace} untraceable={detail.untraceable_receipts} />
            <div className="panel-section">
              <h3>Recommended actions</h3>
              {detail.recommended_actions.map((a) => <div key={a} className="next-action">{a}</div>)}
              <p className="approval-guardrail">{detail.guardrail}</p>
            </div>
            <div className="panel-section recall-notice">
              <h3>{recall.recall_class} · {recall.product}</h3>
              <p className="mini-copy">{recall.reason}</p>
              <div className="kv"><span className="k">Lot / device identifier</span><span className="v">{recall.lot_number} · UDI-DI {recall.udi_device_identifier}</span></div>
              <div className="kv"><span className="k">Issued</span><span className="v">{when(recall.issued_at)} · source record {recall.source_record_id}</span></div>
            </div>
            <div className="mod-summary">
              <Stat label="Received" value={trace.totals.received} />
              <Stat label="Shipped" value={trace.totals.shipped} />
              <Stat label="On hand" value={trace.totals.on_hand} />
              <Stat label="Hospitals" value={trace.customers.length} />
            </div>
            <div className="panel-section">
              <h3>Affected hospitals</h3>
              <table className="mapping-table">
                <thead><tr><th>Hospital</th><th>Orders</th><th>Shipments</th><th>Units</th><th>Last shipped</th></tr></thead>
                <tbody>
                  {trace.customers.map((c) => (
                    <tr key={c.ship_to}><td>{c.ship_to}</td><td>{joinNodes(c.orders.map((po) => link("order-to-cash", po)))}</td><td>{c.shipments.join(", ")}</td><td>{c.quantity}</td><td>{when(c.last_shipped_at)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel-section">
              <h3>Path of lot {recall.lot_number}</h3>
              {trace.flows.map((f) => (
                <div key={f.flow} className="recall-path-flow">
                  <strong>{f.name}</strong> <span className="muted mini-copy">{joinNodes(f.transactions.map((value) => link(f.flow, value)))}</span>
                  <ol className="po-trace">
                    {f.hops.map((h) => (
                      <li key={h.interface?.key}>
                        <strong>{h.interface?.name}</strong>
                        {h.events.map((e) => <small key={e.message_id}>{e.transaction} · {when(e.observed_at)} · {e.detail}</small>)}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
            {detail.untraceable_receipts.length > 0 && (
              <div className="order-trace-impact recall-untraceable">
                Untraceable by lot: {detail.untraceable_receipts.map((r, i) => (
                  <span key={r.receipt_number}>{i ? "; " : ""}{r.receipt_number} ({r.quantity} units, {when(r.observed_at)}, {link("procure-to-pay", r.supplier_po_number)})</span>
                ))}.
                Received before the supplier 856 v2 mapping captured lot numbers.
              </div>
            )}
            <Coverage coverage={detail.coverage} />
            <details className="detail-stack">
              <summary>MongoDB proof <span>business-key aggregation</span></summary>
              <p className="muted mini-copy lineage-trace-copy">{trace.mongodb_trace.purpose}</p>
              <pre className="lineage-pipeline">{trace.mongodb_trace.code}</pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
