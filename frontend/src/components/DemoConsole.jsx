import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import DependencyGraph from "./DependencyGraph.jsx";
import InterfaceDetails from "./InterfaceDetails.jsx";

const pct = (n) => `${Math.round((n || 0) * 100)}%`;

function Stat({ label, value }) {
  return (
    <div className="stat compact-stat">
      <div className="num">{value ?? "—"}</div>
      <div className="lbl">{label}</div>
    </div>
  );
}

function StepButton({ step, index, active, done, disabled, onClick }) {
  return (
    <button className={`demo-step ${active ? "active" : ""} ${done ? "done" : ""}`} disabled={disabled} onClick={onClick}>
      <span className="step-index">{index + 1}</span>
      <span>
        <strong>{step.title}</strong>
        <small>{step.caption}</small>
      </span>
    </button>
  );
}

export default function DemoConsole() {
  const [activeStep, setActiveStep] = useState(0);
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const [flow, setFlow] = useState(null);
  const [detail, setDetail] = useState(null);
  const [impact, setImpact] = useState(null);
  const [impacted, setImpacted] = useState(null);
  const [ingestion, setIngestion] = useState(null);
  const [ingestionResult, setIngestionResult] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState("");
  const [investigation, setInvestigation] = useState(null);
  const [busy, setBusy] = useState(false);

  const selectedScenario = useMemo(
    () => scenarios.find((s) => s.id === selectedScenarioId),
    [scenarios, selectedScenarioId]
  );

  useEffect(() => {
    Promise.all([api.scenarios(), api.ingestion(), api.alerts()])
      .then(([scenarioList, ingestionDashboard, alertList]) => {
        setScenarios(scenarioList || []);
        setSelectedScenarioId(scenarioList?.[0]?.id || "");
        setIngestion(ingestionDashboard);
        setAlerts(alertList.alerts || []);
        setSelectedAlert(alertList.alerts?.[0]?.key || "");
      })
      .catch(() => {});
  }, []);

  const loadDetail = useCallback(async (key) => {
    const [detailResult, impactResult] = await Promise.all([api.interface(key), api.impact(key)]);
    setDetail(detailResult);
    setImpact(impactResult);
  }, []);

  const buildImpacted = (imp) => ({
    failedEdges: [imp.interface.key],
    failedSystems: [imp.interface.target],
    riskEdges: (imp.downstream_interfaces || []).map((i) => i.key),
    riskSystems: (imp.affected_systems || []).map((s) => s.key).filter((k) => k !== imp.interface.target),
  });

  const loadScenario = useCallback(async (scenario = selectedScenario) => {
    if (!scenario) return;
    setBusy(true);
    try {
      const f = await api.flow(scenario.flow_start);
      setFlow(f);
      setImpacted(null);
      setInvestigation(null);
      await loadDetail(scenario.interface_key);
      setActiveStep(1);
    } finally {
      setBusy(false);
    }
  }, [loadDetail, selectedScenario]);

  const runFailure = useCallback(async () => {
    if (!selectedScenario) return;
    setBusy(true);
    try {
      const res = await api.runScenario(selectedScenario.id);
      setFlow(res.flow);
      setImpact(res.impact);
      setImpacted(buildImpacted(res.impact));
      await loadDetail(res.impact.interface.key);
      setActiveStep(2);
    } finally {
      setBusy(false);
    }
  }, [loadDetail, selectedScenario]);

  const normalizeMetadata = useCallback(async () => {
    setBusy(true);
    try {
      const res = await api.runIngestion();
      setIngestionResult(res);
      setIngestion(await api.ingestion());
      setActiveStep(3);
    } finally {
      setBusy(false);
    }
  }, []);

  const investigateAlert = useCallback(async () => {
    if (!selectedAlert) return;
    setBusy(true);
    try {
      setInvestigation(await api.investigation(selectedAlert));
      setActiveStep(4);
    } finally {
      setBusy(false);
    }
  }, [selectedAlert]);

  const resetDemo = useCallback(async () => {
    setBusy(true);
    try {
      await api.reset();
      setImpacted(null);
      setInvestigation(null);
      setIngestionResult(null);
      if (selectedScenario) await loadScenario(selectedScenario);
      else setActiveStep(0);
    } finally {
      setBusy(false);
    }
  }, [loadScenario, selectedScenario]);

  const selectSystem = useCallback((systemKey) => {
    const iface = flow?.interfaces.find((i) => i.target === systemKey) || flow?.interfaces.find((i) => i.source === systemKey);
    if (iface) loadDetail(iface.key);
  }, [flow, loadDetail]);

  const steps = [
    { title: "Pick the story", caption: selectedScenario?.name || "Choose failure" },
    { title: "Reveal topology", caption: flow ? `${flow.nodes.length} systems mapped` : "Load graph" },
    { title: "Inject failure", caption: impacted ? "Impact highlighted" : "Create incident" },
    { title: "Normalize metadata", caption: ingestionResult ? "Sources ingested" : "Run pipeline" },
    { title: "Investigate alert", caption: investigation ? "Root-cause view" : "Correlate evidence" },
  ];

  const completedSteps = [Boolean(selectedScenario), Boolean(flow), Boolean(impacted), Boolean(ingestionResult), Boolean(investigation)];

  const runStep = (index) => {
    setActiveStep(index);
    if (index === 1) loadScenario();
    if (index === 2) runFailure();
    if (index === 3) normalizeMetadata();
    if (index === 4) investigateAlert();
  };

  const quality = ingestion?.quality;

  return (
    <div className="demo-console">
      <section className="demo-hero">
        <div>
          <span className="eyebrow">Presenter mode</span>
          <h2>Find the Failure — guided investigation</h2>
          <p className="muted">Walk through a realistic EDI incident: choose the scenario, traverse the topology, ingest raw enterprise metadata, and correlate an alert to evidence-backed fault domains.</p>
        </div>
        <div className="demo-stats">
          <Stat label="Source records" value={quality?.source_record_count} />
          <Stat label="Typed edges" value={quality?.relationship_count} />
          <Stat label="Alerts" value={alerts.length} />
        </div>
      </section>

      <div className="demo-layout">
        <aside className="demo-rail">
          {steps.map((step, index) => (
            <StepButton key={step.title} step={step} index={index} active={activeStep === index} done={completedSteps[index]} disabled={busy} onClick={() => runStep(index)} />
          ))}
          <button className="scenario-reset full" disabled={busy} onClick={resetDemo}>Reset demo</button>
        </aside>

        <main className="demo-stage">
          <section className="panel-card demo-card">
            <div className="demo-card-head">
              <div>
                <h3>1. Choose a failure scenario</h3>
                <p className="muted">Start with a business-facing symptom, not a static system diagram.</p>
              </div>
              <button className="primary" disabled={busy || !selectedScenario} onClick={() => loadScenario()}>Load topology</button>
            </div>
            <div className="scenario-picker">
              {scenarios.map((scenario) => (
                <button key={scenario.id} className={selectedScenarioId === scenario.id ? "selected" : ""} onClick={() => setSelectedScenarioId(scenario.id)}>
                  <strong>{scenario.name}</strong>
                  <span>{scenario.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="demo-workspace">
            <div className="demo-graph-panel">
              <div className="demo-card-head slim">
                <div>
                  <h3>2. Explore the topology</h3>
                  <p className="muted">Click nodes or edges to pivot the side panel; failure paths animate after injection.</p>
                </div>
                <button className="danger" disabled={busy || !selectedScenario} onClick={runFailure}>Inject failure</button>
              </div>
              <DependencyGraph flow={flow} impacted={impacted} onSelectSystem={selectSystem} onSelectInterface={loadDetail} />
            </div>

            <aside className="demo-detail-panel">
              <InterfaceDetails detail={detail} impact={impact && detail && impact.interface.key === detail.key ? impact : null} onSimulate={runFailure} onReset={resetDemo} busy={busy} />
            </aside>
          </section>

          <div className="ingestion-grid">
            <section className="panel-card">
              <div className="demo-card-head slim">
                <div>
                  <h3>3. Normalize federated metadata</h3>
                  <p className="muted">Turn raw inventory, CMDB, and observability records into graph-ready evidence.</p>
                </div>
                <button className="primary" disabled={busy} onClick={normalizeMetadata}>Normalize</button>
              </div>
              {ingestionResult && <div className="event success">{ingestionResult.source_records} records · {ingestionResult.relationship_upserts} relationships · {ingestionResult.event_upserts} events</div>}
              {quality?.findings.map((f) => <div key={f.label} className={`finding ${f.severity}`}><span>{f.label}</span><strong>{f.count}</strong></div>)}
            </section>

            <section className="panel-card">
              <div className="demo-card-head slim">
                <div>
                  <h3>4. Correlate the alert</h3>
                  <p className="muted">Use the observability alert as the launch point for read-only investigation.</p>
                </div>
                <button className="primary" disabled={busy || !selectedAlert} onClick={investigateAlert}>Investigate</button>
              </div>
              <select value={selectedAlert} onChange={(e) => setSelectedAlert(e.target.value)}>
                {alerts.map((alert) => <option key={alert.key} value={alert.key}>{alert.reason}</option>)}
              </select>
              {investigation && (
                <div className="investigation-mini">
                  <strong>{investigation.investigation_summary}</strong>
                  {investigation.likely_fault_domains.slice(0, 2).map((c) => <div key={c.key} className="candidate"><span>{c.name}</span> <span className="badge">{pct(c.score)}</span><div className="muted">{c.reason}</div></div>)}
                  <div className="chip-row">{investigation.impacted_business_processes.map((p) => <span key={p.key} className="chip risk">{p.name}</span>)}</div>
                  {investigation.recommended_next_actions.slice(0, 3).map((action, i) => <div key={i} className="next-action">{action}</div>)}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}