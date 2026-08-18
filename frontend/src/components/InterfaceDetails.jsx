const fmt = (d) => (d ? new Date(d).toLocaleString() : "—");

function KV({ k, v }) {
  return (
    <div className="kv">
      <span className="k">{k}</span>
      <span className="v">{v ?? "—"}</span>
    </div>
  );
}

export default function InterfaceDetails({ detail, impact, onSimulate, onReset, busy }) {
  if (!detail) return <div className="muted">Click an interface (edge) or system (node) in the graph.</div>;

  const owner = detail.owners?.[0];
  const affected = impact?.affected_systems || [];
  const similar = impact?.similar_failures || [];

  return (
    <div>
      <div className="panel-section">
        <h3>Interface</h3>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{detail.name}</div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{detail.description}</div>
        <span className={`badge status-${detail.last_status}`}>{detail.last_status}</span>{" "}
        <span className="badge">{detail.lifecycle}</span>
      </div>

      <div className="panel-section">
        <KV k="Protocol / Type" v={`${detail.protocol} · ${detail.type}`} />
        <KV k="Message type" v={detail.message_type} />
        <KV k="Source" v={detail.source?.name} />
        <KV k="Target" v={detail.target?.name} />
        <KV k="Version" v={detail.version} />
        <KV k="SLA" v={detail.sla} />
        <KV k="Last success" v={fmt(detail.last_success_at)} />
      </div>

      {owner && (
        <div className="panel-section">
          <h3>Owner / Support</h3>
          <KV k="Team" v={owner.name} />
          <KV k="On-call" v={owner.on_call} />
          <KV k="Slack" v={owner.slack} />
          <KV k="Runbook" v={<a className="link" href={owner.runbook_url} target="_blank" rel="noreferrer">Open runbook</a>} />
        </div>
      )}

      {detail.dataEntities?.length > 0 && (
        <div className="panel-section">
          <h3>Business Data</h3>
          <div className="chip-row">
            {detail.dataEntities.map((d) => <span key={d.key} className="chip">{d.name}</span>)}
          </div>
        </div>
      )}

      <div className="panel-section">
        <h3>Simulate Failure</h3>
        <div className="sim-controls">
          <button className="danger" disabled={busy} onClick={() => onSimulate(detail.key)}>
            Inject "ERP endpoint timeout"
          </button>
          <button disabled={busy} onClick={onReset}>Reset</button>
        </div>
        <div className="muted" style={{ fontSize: 12 }}>{detail.business_impact}</div>
      </div>

      {impact && (
        <>
          <div className="panel-section">
            <h3>Downstream at Risk</h3>
            <div className="chip-row">
              {affected.length === 0 && <span className="muted">None downstream.</span>}
              {affected.map((s) => <span key={s.key} className="chip risk">{s.name}</span>)}
            </div>
          </div>
          <div className="panel-section">
            <h3>Similar Recent Failures</h3>
            {similar.length === 0 && <span className="muted">No similar failures.</span>}
            {similar.map((e, i) => (
              <div key={i} className={`event ${e.status}`}>
                <div>{e.reason}</div>
                <div className="when">{fmt(e.timestamp)} · {e.interface_key}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {!impact && detail.events?.length > 0 && (
        <div className="panel-section">
          <h3>Recent Events</h3>
          {detail.events.map((e, i) => (
            <div key={i} className={`event ${e.status}`}>
              <div>{e.reason}</div>
              <div className="when">{fmt(e.timestamp)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
