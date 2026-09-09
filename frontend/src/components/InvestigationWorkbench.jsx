import { useEffect, useMemo, useState } from "react";
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
      <span className={`badge status-${alert.status}`}>{alert.severity}</span>
      <strong>{alert.reason}</strong>
      <small>{alert.source_system} · {alert.interface_key}</small>
    </button>
  );
}

function Timeline({ steps }) {
  return (
    <section className="panel-card agent-timeline">
      <h3>Agent activity</h3>
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

function SummaryPanel({ result }) {
  if (!result) return <section className="panel-card hero-card"><h3>Investigation summary</h3><p className="muted">Select an alert and start an investigation.</p></section>;
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
  return (
    <section className="panel-card evidence-panel">
      <h3>Evidence and next checks</h3>
      {!result && <p className="muted">Evidence appears as the agent investigates the alert.</p>}
      {(result?.evidence || []).map((item, i) => <div key={i} className="evidence">{item}</div>)}
      {(result?.recommended_next_actions || []).map((action, i) => <div key={i} className="next-action">{action}</div>)}
    </section>
  );
}

function FollowUpPanel({ result, messages, question, setQuestion, onAsk }) {
  const canAsk = Boolean(result);
  return (
    <section className="panel-card followup-panel">
      <h3>Ask follow-up</h3>
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

export default function InvestigationWorkbench() {
  const [alerts, setAlerts] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [steps, setSteps] = useState(STEP_TEMPLATE.map((s) => ({ ...s, status: "pending" })));
  const [result, setResult] = useState(null);
  const [flow, setFlow] = useState(null);
  const [impacted, setImpacted] = useState(null);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");

  const selectedAlert = useMemo(() => alerts.find((a) => a.key === selectedKey), [alerts, selectedKey]);

  useEffect(() => {
    api.alerts().then((res) => {
      setAlerts(res.alerts || []);
      setSelectedKey(res.alerts?.[0]?.key || "");
    }).catch(() => {});
  }, []);

  const mark = (id, status, detail) => {
    setSteps((current) => current.map((s) => s.id === id ? { ...s, status, detail: detail || s.detail } : s));
  };

  const startInvestigation = async () => {
    if (!selectedAlert) return;
    setBusy(true);
    setResult(null);
    setFlow(null);
    setImpacted(null);
    setMessages([]);
    setSteps(STEP_TEMPLATE.map((s) => ({ ...s, status: "pending" })));
    try {
      mark("received", "running", `${selectedAlert.severity.toUpperCase()} alert from ${selectedAlert.source_system}.`);
      await pause(250);
      mark("received", "complete", `Alert ${selectedAlert.external_id} received.`);

      mark("mapped", "running", "Resolving alert entity to canonical interface.");
      const [investigation, graph] = await Promise.all([
        api.investigation(selectedAlert.key),
        api.flow(selectedAlert.interface_key),
      ]);
      mark("mapped", "complete", `Mapped to ${investigation.topology.alert_interface.name}.`);
      await pause(250);

      mark("topology", "running", "Loading dependency graph from MongoDB.");
      setFlow(graph);
      mark("topology", "complete", `${graph.nodes.length} systems and ${graph.edges.length} interfaces loaded.`);
      await pause(250);

      mark("impact", "running", "Checking business impact and downstream risk.");
      setImpacted({
        failedEdges: [investigation.alert.interface_key],
        failedSystems: investigation.likely_fault_domains.filter((c) => c.type === "system").slice(0, 1).map((c) => c.key),
        riskEdges: investigation.topology.downstream_interfaces.map((i) => i.key),
        riskSystems: investigation.affected_systems.map((s) => s.key),
      });
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
    } finally {
      setBusy(false);
    }
  };

  const ask = (q) => {
    const trimmed = q.trim();
    if (!trimmed || !result) return;
    setMessages((current) => [...current, { role: "user", text: trimmed }, { role: "agent", text: answerQuestion(trimmed, result) }]);
    setQuestion("");
  };

  return (
    <div className="workbench">
      <aside className="alert-inbox">
        <span className="eyebrow">Agent v1</span>
        <h2>Investigation Workbench</h2>
        <p className="muted">Start from an alert. The agent correlates topology, impact, owners, evidence, and safe next checks.</p>
        <h3>Alert inbox</h3>
        {alerts.map((alert) => <AlertCard key={alert.key} alert={alert} active={alert.key === selectedKey} onClick={() => setSelectedKey(alert.key)} />)}
        <button className="primary full" disabled={busy || !selectedAlert} onClick={startInvestigation}>{busy ? "Investigating…" : "Investigate selected alert"}</button>
      </aside>

      <main className="workbench-main">
        <section className="workbench-header">
          <div>
            <span className="eyebrow">Active case</span>
            <h2>{selectedAlert?.reason || "No alert selected"}</h2>
            <p className="muted">{selectedAlert?.detail || "Choose an alert to begin."}</p>
          </div>
          <div className="case-stats">
            <Stat label="Severity" value={selectedAlert?.severity || "—"} />
            <Stat label="Confidence" value={result?.likely_fault_domains?.[0] ? pct(result.likely_fault_domains[0].score) : "Building"} />
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
            <EvidencePanel result={result} />
            <FollowUpPanel result={result} messages={messages} question={question} setQuestion={setQuestion} onAsk={ask} />
          </aside>
        </div>
      </main>
    </div>
  );
}