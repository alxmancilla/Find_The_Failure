import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import DependencyGraph from "./DependencyGraph.jsx";

const pct = (n) => `${Math.round((n || 0) * 100)}%`;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const STEP_TEMPLATE = [
  { id: "received", label: "Alert received", detail: "Waiting for an observability signal." },
  { id: "mapped", label: "Mapped to interface", detail: "Resolve the alert to canonical integration metadata." },
  { id: "topology", label: "Loaded topology", detail: "Retrieve the dependency path and related systems." },
  { id: "impact", label: "Assessed impact", detail: "Identify business processes, owners, and downstream risk." },
  { id: "evidence", label: "Collected evidence", detail: "Gather source records, relationship evidence, and events." },
  { id: "ranked", label: "Ranked fault domains", detail: "Score likely causes with supporting rationale." },
  { id: "summary", label: "Generated next checks", detail: "Produce safe, human-reviewable recommendations." },
];

const SUGGESTED_QUESTIONS = [
  "Why is this the likely fault domain?",
  "What business process is impacted?",
  "Who owns this interface?",
  "What evidence supports this?",
  "What should I check first?",
];

const CASE_EVENT_TO_STEP = {
  case_opened: "received",
  alert_mapped: "mapped",
  topology_loaded: "topology",
  impact_assessed: "impact",
  evidence_collected: "evidence",
  fault_ranked: "ranked",
  next_checks_ready: "summary",
};

function StatusPill({ status }) {
  return <span className={`agent-status ${status}`}>{status}</span>;
}

function Stat({ label, value }) {
  return (
    <div className="stat compact-stat">
      <div className="num">{value ?? "—"}</div>
      <div className="lbl">{label}</div>
    </div>
  );
}

function AlertCard({ alert, active, onClick }) {
  return (
    <button className={`alert-card ${active ? "active" : ""}`} onClick={onClick}>
      <span className="alert-card-top">
        <span className={`badge status-${alert.status}`}>{alert.severity || "alert"}</span>
        <span className="alert-status-label">{alert.status || "open"}</span>
      </span>
      <strong>{alert.reason}</strong>
      <small>{alert.source_system} · {alert.interface_key}</small>
      {alert.detail && <span className="alert-preview">{alert.detail}</span>}
    </button>
  );
}

function Timeline({ steps }) {
  const completeCount = steps.filter((step) => step.status === "complete").length;
  const runningStep = steps.find((step) => step.status === "running");
  const progress = Math.round((completeCount / steps.length) * 100);
  return (
    <section className="panel-card agent-timeline">
      <div className="panel-title-row">
        <div>
          <h3>Agent activity</h3>
          <p className="muted mini-copy">{runningStep ? runningStep.detail : `${completeCount} of ${steps.length} steps complete`}</p>
        </div>
        <span className="progress-pill">{progress}%</span>
      </div>
      <div className="progress-track" aria-label="Investigation progress">
        <span style={{ width: `${progress}%` }} />
      </div>
      {steps.map((step) => (
        <div key={step.id} className={`timeline-step ${step.status}`}>
          <span className="timeline-dot" />
          <div>
            <div><strong>{step.label}</strong> <StatusPill status={step.status} /></div>
            <p>{step.detail}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

function CaseMemory({ cases, activeCase, onSelect }) {
  return (
    <section className="case-memory">
      <div className="section-title-row">
        <h3>Case memory</h3>
        <span className="count-pill">{cases.length}</span>
      </div>
      {!cases.length && (
        <div className="empty-card">
          <strong>No saved cases yet</strong>
          <p>Investigate an alert to create an auditable timeline and grounded Q&A history.</p>
        </div>
      )}
      {cases.map((item) => (
        <button key={item.key} className={`case-card ${activeCase?.key === item.key ? "active" : ""}`} onClick={() => onSelect(item.key)}>
          <strong>{item.alert_snapshot?.reason || "Investigation case"}</strong>
          <small>{item.top_fault_domain?.name || "Fault domain pending"} · {item.status}</small>
        </button>
      ))}
    </section>
  );
}

function CaseTimeline({ caseRecord }) {
  return (
    <section className="panel-card case-timeline">
      <h3>Case timeline</h3>
      {!caseRecord && <p className="muted">Start or select an investigation to see persisted case history.</p>}
      {(caseRecord?.timeline || []).map((item, i) => (
        <div key={`${item.event}-${i}`} className="case-timeline-item">
          <span>{item.at ? new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
          <div><strong>{item.label}</strong><p>{item.detail}</p></div>
        </div>
      ))}
    </section>
  );
}

function SummaryPanel({ result }) {
  if (!result) return (
    <section className="panel-card hero-card empty-summary">
      <span className="eyebrow">Ready</span>
      <h3>Investigation summary</h3>
      <p className="muted">Select an alert, then start an investigation to generate a grounded summary, likely fault domain, evidence, and next checks.</p>
      <ol className="coach-list">
        <li>Choose an alert from the inbox</li>
        <li>Open an auditable case</li>
        <li>Review impact and safe next checks</li>
      </ol>
    </section>
  );
  const top = result.likely_fault_domains?.[0];
  const processes = result.impacted_business_processes || [];
  const owners = result.owners || [];
  return (
    <section className="panel-card hero-card">
      <h3>Investigation summary</h3>
      <p>{result.investigation_summary}</p>
      {top && <div className="fault-callout"><strong>{top.name}</strong><span>{pct(top.score)} confidence</span></div>}
      <div className="chip-row">
        {processes.map((p) => <span key={p.key} className="chip risk">{p.name}</span>)}
        {owners.map((o) => <span key={o.key} className="chip">{o.name}</span>)}
      </div>
    </section>
  );
}

function EvidencePanel({ result }) {
  const evidence = result?.evidence || [];
  const actions = result?.recommended_next_actions || [];
  return (
    <section className="panel-card evidence-panel">
      <div className="panel-title-row compact">
        <h3>Evidence and next checks</h3>
        {result && <span className="count-pill">{evidence.length + actions.length}</span>}
      </div>
      {!result && <p className="muted">Evidence appears as the agent investigates the alert.</p>}
      {Boolean(evidence.length) && <h4>Grounding evidence</h4>}
      {evidence.map((item, i) => <div key={i} className="evidence">{item}</div>)}
      {Boolean(actions.length) && <h4>Recommended next checks</h4>}
      {actions.map((action, i) => <div key={i} className="next-action">{action}</div>)}
    </section>
  );
}

function FollowUpPanel({ result, messages, question, setQuestion, onAsk }) {
  const canAsk = Boolean(result);
  return (
    <section className="panel-card followup-panel">
      <div className="panel-title-row compact">
        <div>
          <h3>Ask follow-up</h3>
          <p className="muted mini-copy">Answers are restricted to the active investigation result.</p>
        </div>
      </div>
      <div className="suggested-questions">
        {SUGGESTED_QUESTIONS.map((q) => <button key={q} disabled={!canAsk} onClick={() => onAsk(q)}>{q}</button>)}
      </div>
      <div className="chat-log">
        {messages.length === 0 && <p className="muted">Ask about this active investigation case.</p>}
        {messages.map((m, i) => <div key={i} className={`chat-msg ${m.role}`}><strong>{m.role === "user" ? "You" : "Agent"}</strong><p>{m.text}</p></div>)}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); onAsk(question); }}>
        <input value={question} disabled={!canAsk} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about impact, owners, evidence, or next checks…" />
        <button className="primary" disabled={!canAsk || !question.trim()}>Ask</button>
      </form>
    </section>
  );
}

function answerQuestion(question, result) {
  const q = question.toLowerCase();
  const top = result.likely_fault_domains?.[0];
  const processes = (result.impacted_business_processes || []).map((p) => p.name).join(", ") || "no mapped business process";
  const owners = (result.owners || []).map((o) => o.name).join(", ") || "no mapped owner";
  const actions = (result.recommended_next_actions || []).slice(0, 2).join(" ");
  if (q.includes("why") || q.includes("fault")) return `${top?.name || "The top candidate"} is ranked highest because ${top?.reason || "the alert maps directly to this domain"}`;
  if (q.includes("business") || q.includes("process") || q.includes("impact")) return `The impacted business process is ${processes}. Affected systems include ${(result.affected_systems || []).map((s) => s.name).join(", ") || "the mapped downstream systems"}.`;
  if (q.includes("owner") || q.includes("owns")) return `The mapped owner is ${owners}. Use the runbook/contact metadata before taking remediation steps.`;
  if (q.includes("evidence") || q.includes("support")) return `The strongest evidence is: ${(result.evidence || []).slice(0, 3).join(" ")}`;
  if (q.includes("check") || q.includes("next") || q.includes("first")) return actions || "Start by checking the top fault domain health and validating the interface logs for the alert window.";
  return `For this case, ${result.investigation_summary} Recommended next check: ${(result.recommended_next_actions || [])[0] || "review the top fault domain evidence."}`;
}

function impactedFromInvestigation(investigation) {
  if (!investigation) return null;
  return {
    failedEdges: [investigation.alert?.interface_key].filter(Boolean),
    failedSystems: (investigation.likely_fault_domains || []).filter((c) => c.type === "system").slice(0, 1).map((c) => c.key),
    riskEdges: (investigation.topology?.downstream_interfaces || []).map((i) => i.key),
    riskSystems: (investigation.affected_systems || []).map((s) => s.key),
  };
}

function stepsFromCase(caseRecord) {
  const byStep = Object.fromEntries(
    (caseRecord?.timeline || [])
      .map((entry) => [CASE_EVENT_TO_STEP[entry.event], entry])
      .filter(([id]) => Boolean(id))
  );
  return STEP_TEMPLATE.map((step) => byStep[step.id]
    ? { ...step, status: "complete", detail: byStep[step.id].detail }
    : { ...step, status: "pending" });
}

export default function InvestigationWorkbench() {
  const [alerts, setAlerts] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [steps, setSteps] = useState(STEP_TEMPLATE.map((s) => ({ ...s, status: "pending" })));
  const [result, setResult] = useState(null);
  const [flow, setFlow] = useState(null);
  const [impacted, setImpacted] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedBusy, setFeedBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [feedStatus, setFeedStatus] = useState("");
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [cases, setCases] = useState([]);
  const [activeCase, setActiveCase] = useState(null);
  const [caseStatus, setCaseStatus] = useState("");

  const selectedAlert = useMemo(() => alerts.find((a) => a.key === selectedKey), [alerts, selectedKey]);

  const loadAlerts = useCallback(async () => {
    const res = await api.alerts();
    const nextAlerts = res.alerts || [];
    setAlerts(nextAlerts);
    setSelectedKey((current) => nextAlerts.some((alert) => alert.key === current) ? current : nextAlerts[0]?.key || "");
    return nextAlerts;
  }, []);

  const loadCases = useCallback(async () => {
    const res = await api.cases();
    setCases(res.cases || []);
    return res.cases || [];
  }, []);

  useEffect(() => {
    loadAlerts().catch(() => setFeedStatus("Unable to load alert inbox."));
    loadCases().catch(() => setCaseStatus("Unable to load case memory."));
  }, [loadAlerts, loadCases]);

  useEffect(() => {
    if (!selectedAlert?.interface_key) return;
    let ignore = false;
    api.flow(selectedAlert.interface_key)
      .then((graph) => {
        if (!ignore) setFlow(graph);
      })
      .catch(() => {
        if (!ignore) setFlow(null);
      });
    return () => {
      ignore = true;
    };
  }, [selectedAlert]);

  const mark = (id, status, detail) => {
    setSteps((current) => current.map((s) => s.id === id ? { ...s, status, detail: detail || s.detail } : s));
  };

  const selectAlert = (key) => {
    setSelectedKey(key);
    setActiveCase(null);
    setResult(null);
    setImpacted(null);
    setMessages([]);
    setSteps(STEP_TEMPLATE.map((s) => ({ ...s, status: "pending" })));
  };

  const selectCase = async (caseKey) => {
    setCaseStatus("Loading saved case…");
    try {
      const { case: savedCase } = await api.case(caseKey);
      const investigation = savedCase.investigation_result;
      setActiveCase(savedCase);
      setResult(investigation);
      setMessages(savedCase.messages || []);
      setSteps(stepsFromCase(savedCase));
      setImpacted(impactedFromInvestigation(investigation));
      setSelectedKey(savedCase.alert_key || "");
      if (savedCase.alert_snapshot?.interface_key) setFlow(await api.flow(savedCase.alert_snapshot.interface_key));
      setCaseStatus(`Loaded ${savedCase.key}.`);
    } catch (err) {
      setCaseStatus(err.message || "Unable to load case.");
    }
  };

  const startInvestigation = async () => {
    if (!selectedAlert) return;
    setBusy(true);
    setResult(null);
    setFlow(null);
    setImpacted(null);
    setMessages([]);
    setActiveCase(null);
    setCaseStatus("Creating auditable case record…");
    setSteps(STEP_TEMPLATE.map((s) => ({ ...s, status: "pending" })));
    try {
      mark("received", "running", `${selectedAlert.severity.toUpperCase()} alert from ${selectedAlert.source_system}.`);
      await pause(250);
      mark("received", "complete", `Alert ${selectedAlert.external_id} received.`);

      mark("mapped", "running", "Resolving alert entity to canonical interface.");
      const [{ case: nextCase, investigation }, graph] = await Promise.all([
        api.createInvestigationCase(selectedAlert.key),
        api.flow(selectedAlert.interface_key),
      ]);
      setActiveCase(nextCase);
      setCaseStatus(`Case ${nextCase.key} opened and stored.`);
      mark("mapped", "complete", `Mapped to ${investigation.topology.alert_interface.name}.`);
      await pause(250);

      mark("topology", "running", "Loading dependency graph from MongoDB.");
      setFlow(graph);
      mark("topology", "complete", `${graph.nodes.length} systems and ${graph.edges.length} interfaces loaded.`);
      await pause(250);

      mark("impact", "running", "Checking business impact and downstream risk.");
      setImpacted(impactedFromInvestigation(investigation));
      mark("impact", "complete", `${investigation.impacted_business_processes.length || 0} process and ${investigation.affected_systems.length} systems at risk.`);
      await pause(250);

      mark("evidence", "running", "Collecting evidence and provenance.");
      mark("evidence", "complete", `${investigation.evidence.length} evidence items collected.`);
      await pause(250);

      mark("ranked", "running", "Scoring candidate fault domains.");
      mark("ranked", "complete", `${investigation.likely_fault_domains[0]?.name} ranked highest.`);
      await pause(250);

      mark("summary", "running", "Preparing human-reviewable next checks.");
      setResult(investigation);
      mark("summary", "complete", `${investigation.recommended_next_actions.length} recommended checks ready.`);
      setSteps(stepsFromCase(nextCase));
      loadCases().catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const ask = async (q) => {
    const trimmed = q.trim();
    if (!trimmed || !result) return;
    const answer = answerQuestion(trimmed, result);
    const optimistic = [{ role: "user", text: trimmed }, { role: "agent", text: answer }];
    setMessages((current) => [...current, ...optimistic]);
    setQuestion("");
    if (!activeCase?.key) return;
    try {
      const { case: savedCase } = await api.appendCaseMessages(activeCase.key, { question: trimmed, answer });
      setActiveCase(savedCase);
      setMessages(savedCase.messages || []);
      loadCases().catch(() => {});
    } catch {
      setCaseStatus("Follow-up was answered locally but not saved to case memory.");
    }
  };

  const ingestLatestAlerts = async () => {
    setFeedBusy(true);
    setFeedStatus("Listening for latest observability alerts…");
    try {
      const res = await api.ingestDemoAlerts();
      setAlerts(res.alerts || []);
      setSelectedKey((current) => (res.alerts || []).some((alert) => alert.key === current) ? current : res.alerts?.[0]?.key || "");
      const refreshed = Math.max((res.upserted_alerts || 0) - (res.inserted_alerts || 0), 0);
      setFeedStatus(
        res.inserted_alerts
          ? `${res.inserted_alerts} new alerts ingested from observability feed.`
          : `${refreshed} feed alerts refreshed; inbox is up to date.`
      );
    } catch (err) {
      setFeedStatus(err.message || "Unable to ingest latest alerts.");
    } finally {
      setFeedBusy(false);
    }
  };

  const clearDemoState = async () => {
    setResetBusy(true);
    setFeedStatus("Clearing simulated feed alerts and case memory…");
    try {
      const res = await api.clearWorkbenchDemoState();
      const nextAlerts = res.alerts || [];
      setAlerts(nextAlerts);
      setCases(res.cases || []);
      setSelectedKey(nextAlerts[0]?.key || "");
      setActiveCase(null);
      setResult(null);
      setImpacted(null);
      setMessages([]);
      setQuestion("");
      setSteps(STEP_TEMPLATE.map((s) => ({ ...s, status: "pending" })));
      setFeedStatus(`${res.deleted_feed_alerts} feed alerts cleared; ${res.deleted_cases} cases removed.`);
      setCaseStatus("Case memory cleared for the next rehearsal.");
    } catch (err) {
      setFeedStatus(err.message || "Unable to clear rehearsal state.");
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="workbench">
      <aside className="alert-inbox">
        <span className="eyebrow">Agent v1</span>
        <h2>Investigation Workbench</h2>
        <p className="muted">Alert-first, read-only workflow for mapping operational signals to topology, owners, impact, evidence, and safe next checks.</p>
        <div className="demo-hint">
          <strong>Suggested demo path</strong>
          <span>Investigate the ERP alert, ingest latest alerts, then clear feed + cases to reset.</span>
        </div>
        <div className="alert-inbox-head">
          <h3>Alert inbox</h3>
          <span className="count-pill">{alerts.length}</span>
        </div>
        <div className="alert-inbox-actions">
          <button disabled={feedBusy || resetBusy || busy} onClick={ingestLatestAlerts}>{feedBusy ? "Ingesting…" : "Ingest latest alerts"}</button>
          <button className="danger" disabled={feedBusy || resetBusy || busy} onClick={clearDemoState}>{resetBusy ? "Clearing…" : "Clear feed + cases"}</button>
        </div>
        <p className="feed-status">{feedStatus || "Simulates a targeted observability feed ingest without resetting demo data."}</p>
        {alerts.map((alert) => <AlertCard key={alert.key} alert={alert} active={alert.key === selectedKey} onClick={() => selectAlert(alert.key)} />)}
        <button className="primary full" disabled={busy || !selectedAlert} onClick={startInvestigation}>{busy ? "Investigating…" : "Investigate selected alert"}</button>
        <p className="feed-status">{caseStatus || "Case memory stores investigation history and grounded follow-up."}</p>
        <CaseMemory cases={cases} activeCase={activeCase} onSelect={selectCase} />
      </aside>

      <main className="workbench-main">
        <section className="workbench-header">
          <div>
            <span className="eyebrow">Active case</span>
            <h2>{selectedAlert?.reason || "No alert selected"}</h2>
            <p className="muted">{selectedAlert?.detail || "Choose an alert to begin."}</p>
            {selectedAlert && (
              <div className="case-context">
                <span>{selectedAlert.external_id || "source alert"}</span>
                <span>{selectedAlert.source_system}</span>
                <span>{selectedAlert.interface_key}</span>
                {activeCase?.key && <span>Saved as {activeCase.key}</span>}
              </div>
            )}
          </div>
          <div className="case-stats">
            <Stat label="Severity" value={selectedAlert?.severity || "—"} />
            <Stat label="Confidence" value={result?.likely_fault_domains?.[0] ? pct(result.likely_fault_domains[0].score) : busy ? "Building" : "—"} />
            <Stat label="Evidence" value={result?.evidence?.length ?? "—"} />
          </div>
        </section>

        <div className="workbench-grid">
          <div className="workbench-center">
            <Timeline steps={steps} />
            <section className="panel-card workbench-graph">
              <h3>Topology impact graph</h3>
              <DependencyGraph flow={flow} impacted={impacted} />
            </section>
          </div>

          <aside className="workbench-right">
            <SummaryPanel result={result} />
            <CaseTimeline caseRecord={activeCase} />
            <EvidencePanel result={result} />
            <FollowUpPanel result={result} messages={messages} question={question} setQuestion={setQuestion} onAsk={ask} />
          </aside>
        </div>
      </main>
    </div>
  );
}