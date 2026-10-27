import { useEffect, useState } from "react";
import { api } from "../api.js";

const STATUS_LABEL = { delivered: "Delivered", failed: "Failed", on_hold: "On hold", blocked: "Blocked", not_reached: "Not reached", pending: "Pending" };
const when = (d) => (d ? new Date(d).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

const longDay = (d) => new Date(`${d}T00:00:00`).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });

export function AsOfBanner({ asOf, onClear, subject = "mappings", inset = false }) {
  if (!asOf) return null;
  return (
    <div className={`as-of-banner ${inset ? "inset" : ""}`} role="status">
      <span>Viewing {subject} as of <strong>{longDay(asOf)}</strong>. Current mappings may differ.</span>
      <button type="button" onClick={onClear}>Back to current</button>
    </div>
  );
}

// Radio group with arrow-key navigation.
export function Segmented({ label, options, value, onChange }) {
  const move = (event, index) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = options[(index + step + options.length) % options.length];
    onChange(next.id);
    event.currentTarget.parentElement.querySelectorAll("button")[options.indexOf(next)]?.focus();
  };
  return (
    <div>
      <span className="control-label" id={`seg-${label}`}>{label}</span>
      <div className="segmented" role="radiogroup" aria-labelledby={`seg-${label}`}>
        {options.map((option, index) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={option.id === value}
            tabIndex={option.id === value ? 0 : -1}
            onClick={() => onChange(option.id)}
            onKeyDown={(event) => move(event, index)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Design path ("follow the identifier") with an optional per-order overlay.
export function OrderTrace({ flow, defaultOpen = false }) {
  const [transactions, setTransactions] = useState([]);
  const [selected, setSelected] = useState("");
  const [trace, setTrace] = useState(null);

  useEffect(() => {
    setSelected("");
    if (!flow?.flow) return;
    api.lineageTransactions(flow.flow).then((res) => setTransactions(res.transactions || [])).catch(() => setTransactions([]));
  }, [flow?.flow]);

  useEffect(() => {
    if (!selected) return setTrace(null);
    api.lineageTransaction(selected, flow?.flow).then(setTrace).catch(() => setTrace(null));
  }, [selected, flow?.flow]);

  if (!flow) return null;
  const statusByStep = new Map((trace?.steps || []).map((s) => [s.step, s]));
  return (
    <details className="detail-stack lineage-trace" open={defaultOpen || Boolean(selected)}>
      <summary>Follow the {flow.identifier_label || "PO number"} <span>{flow.steps.length} hops</span></summary>
      <div className="order-trace-picker">
        <label>
          <span>Trace a sample order</span>
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Design path only</option>
            {transactions.map((t) => <option key={t.value} value={t.value}>{t.value} · {t.status.replace("_", " ")}</option>)}
          </select>
        </label>
      </div>
      <p className="muted mini-copy lineage-trace-copy">{trace?.summary || flow.summary}</p>
      {trace?.data_impact?.entities_at_risk?.length > 0 && (
        <p className="order-trace-impact">Not produced yet: {trace.data_impact.entities_at_risk.map((e) => e.name).join(", ")}</p>
      )}
      <ol className="po-trace">
        {flow.steps.map((step) => {
          const live = statusByStep.get(step.step);
          return (
            <li key={step.interface.key} className={`${step.changes_shape ? "changes" : ""} ${live ? `trace-${live.status}` : ""}`}>
              <strong>{step.step}. {step.interface.name} {live && <span className={`trace-pill trace-${live.status}`}>{STATUS_LABEL[live.status] || live.status}</span>}</strong>
              <small>{step.from_system.name} → {step.to_system.name}{step.via?.length ? ` (via ${step.via.map((s) => s.name).join(", ")})` : ""}{step.changes_shape ? ` · ${step.input_entity?.name} → ${step.output_entity?.name}` : ""}</small>
              <code>{step.identifier_mapping?.target_path || "—"} · mapping {step.mapping_version}</code>
              {live?.event && <small>{live.event.message_id} · {when(live.event.observed_at)} · {live.event.detail}</small>}
            </li>
          );
        })}
      </ol>
      {trace && <p className="muted mini-copy lineage-trace-copy">Sample tracking events from <code>message_events</code>, matched on the business key.</p>}
    </details>
  );
}

export function MappingVersion({ transformation }) {
  return (
    <div className="kv">
      <span className="k">Mapping version</span>
      <span className="v">
        {transformation.mapping_version}{transformation.mapping_standard ? ` (${transformation.mapping_standard})` : ""} · effective {day(transformation.mapping_effective_from)}
        {transformation.mapping_effective_to ? ` to ${day(transformation.mapping_effective_to)}` : ""}
        {transformation.mapping_versions_total > 1 ? ` · ${transformation.mapping_versions_total} versions` : ""}
      </span>
    </div>
  );
}

export function StewardReview({ transformation, onReviewed }) {
  const [busy, setBusy] = useState(false);
  const review = transformation.review;
  if (transformation.confirmed && !review) return null;
  const decide = async (decision) => {
    setBusy(true);
    try {
      await api.reviewLineageEdge(transformation.key, { decision });
      onReviewed?.();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="steward-review">
      <span>Data steward review</span>
      {review ? <p>{review.label} · {review.actor} · {when(review.at)}</p> : <p>Inferred at {Math.round(transformation.confidence * 100)}% confidence. Confirm it, or reject it to remove it from lineage.</p>}
      <div className="approval-actions">
        <button type="button" disabled={busy} onClick={() => decide("confirmed")}>Confirm</button>
        <button type="button" disabled={busy} onClick={() => decide("rejected")}>Reject</button>
      </div>
      <small>Local stewardship decision stored on the relationship; no external catalog is changed.</small>
    </div>
  );
}

export function StewardDecisions({ refreshKey, onReset }) {
  const [reviews, setReviews] = useState([]);
  useEffect(() => {
    api.lineageReviews().then((res) => setReviews(res.reviews || [])).catch(() => setReviews([]));
  }, [refreshKey]);
  if (!reviews.length) return null;
  const reset = async () => {
    await api.clearLineageReviews();
    onReset?.();
  };
  return (
    <section className="panel-section steward-decisions">
      <h3>Steward decisions</h3>
      {reviews.map((r) => (
        <div key={r.key} className="evidence">
          <strong>{r.from_key} → {r.to_key}</strong> · {r.review?.label}
          <div className="when">{r.review?.note} ({r.review_history.length} decision{r.review_history.length === 1 ? "" : "s"})</div>
        </div>
      ))}
      <button type="button" className="full" onClick={reset}>Reset steward decisions</button>
    </section>
  );
}

export function StandardsPanel({ flowKey = "order-to-cash" }) {
  const [metamodel, setMetamodel] = useState(null);
  useEffect(() => {
    api.lineageMetamodel().then(setMetamodel).catch(() => setMetamodel(null));
  }, []);
  if (!metamodel) return null;
  return (
    <details className="detail-stack">
      <summary>Standards mapping <span>ArchiMate · OpenLineage</span></summary>
      <table className="mapping-table standards-table">
        <thead><tr><th>Model</th><th>ArchiMate</th><th>OpenLineage</th></tr></thead>
        <tbody>
          {metamodel.elements.map((e) => <tr key={e.collection}><td>{e.collection}</td><td>{e.archimate}</td><td>{e.openlineage}</td></tr>)}
          {metamodel.relationships.map((r) => <tr key={r.type}><td>{r.type}</td><td>{r.archimate}</td><td>{r.openlineage}</td></tr>)}
        </tbody>
      </table>
      <p className="muted mini-copy lineage-trace-copy">{metamodel.notes}</p>
      <p className="lineage-trace-copy"><a className="link" href={`/api/lineage/flows/${flowKey}/openlineage`} target="_blank" rel="noreferrer">Export this flow as OpenLineage RunEvents →</a></p>
    </details>
  );
}
