import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import DependencyGraph from "./DependencyGraph.jsx";

const pct = (n) => `${Math.round((n || 0) * 100)}%`;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const STEP_TEMPLATE = [
  { id: "received", label: "Alert received", detail: "Load the selected raw alert from the Workbench inbox." },
  { id: "mapped", label: "Mapped to interface", detail: "Resolve the alert to canonical integration metadata." },
  { id: "topology", label: "Loaded topology", detail: "Retrieve the dependency path and related systems." },
  { id: "impact", label: "Assessed impact", detail: "Identify business processes, owners, and downstream risk." },
  { id: "related", label: "Retrieved related context", detail: "Search runbooks and prior incidents for matching symptoms." },
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
  related_context_retrieved: "related",
  evidence_collected: "evidence",
  fault_ranked: "ranked",
  next_checks_ready: "summary",
};

const ALERT_GROUP_ORDER = [
  "Hospital Order Fulfillment",
  "Supplier Replenishment",
  "Starting / unassigned alerts",
];
const PROCESS_FILTER_ALL = "All processes";

const PLAYBOOK_PHASES = [
  {
    id: "intake",
    label: "Intake",
    detail: "Capture the alert and map it to a known integration asset.",
    stageIds: ["received", "mapped"],
  },
  {
    id: "impact",
    label: "Impact",
    detail: "Load topology and translate technical risk into business impact.",
    stageIds: ["topology", "impact"],
  },
  {
    id: "evidence",
    label: "Evidence",
    detail: "Retrieve related context and collect auditable provenance.",
    stageIds: ["related", "evidence"],
  },
  {
    id: "recommendation",
    label: "Recommendation",
    detail: "Rank fault domains and prepare safe next checks.",
    stageIds: ["ranked", "summary"],
  },
];

const MONGODB_STAGE_EXPLANATIONS = {
  received: {
    capability: "Durable alert intake and case memory",
    collections: ["source_records", "investigation_cases"],
    queryPattern: "Find the selected alert source record and create an auditable case document.",
    learns: "The agent captures the raw observability signal, source system, severity, status, and alert-to-interface key.",
    demoLine: "MongoDB gives the workflow a durable starting point instead of a transient alert notification.",
  },
  mapped: {
    capability: "Canonical interface mapping",
    collections: ["interfaces", "systems", "owners"],
    queryPattern: "Lookup the mapped interface by key, then load related system and owner metadata.",
    learns: "The agent turns a raw alert entity into a known Apex ERP integration asset with accountable teams.",
    demoLine: "This is where the alert becomes business-readable integration context.",
  },
  topology: {
    capability: "Operational context graph traversal",
    collections: ["relationships", "interfaces", "systems"],
    queryPattern: "Traverse upstream and downstream relationship edges around the mapped interface.",
    learns: "The agent identifies dependency paths, downstream consumers, and adjacent systems at risk.",
    demoLine: "MongoDB acts as the topology graph behind the investigation.",
  },
  impact: {
    capability: "Business-process impact lookup",
    collections: ["business_processes", "relationships", "interfaces"],
    queryPattern: "Follow supports_process and depends_on relationships to map topology risk to business workflows.",
    learns: "The agent links technical degradation to Hospital Order Fulfillment or Supplier Replenishment impact.",
    demoLine: "This is the shift from system outage to business impact.",
  },
  related: {
    capability: "Atlas retrieval for related operational context",
    collections: ["operational_knowledge"],
    queryPattern: "Search runbooks, incident notes, and business context for text related to the active alert.",
    learns: "The agent sees similar incidents, relevant runbooks, and operational notes before ranking the fault domain.",
    demoLine: "Atlas Search provides immediate value; Automated Embeddings and reranking can be enabled for semantic retrieval when available.",
  },
  evidence: {
    capability: "Grounded evidence and provenance",
    collections: ["source_records", "relationships", "events"],
    queryPattern: "Collect source inventory, CMDB, observability, and relationship evidence attached to the path.",
    learns: "The agent shows why the path and impact assessment are credible, not just the final conclusion.",
    demoLine: "MongoDB stores the evidence trail the human can audit.",
  },
  ranked: {
    capability: "Evidence-based fault-domain ranking",
    collections: ["source_records", "interfaces", "relationships", "owners"],
    queryPattern: "Score candidate domains using severity, status, direct mapping, evidence count, ownership, and topology ambiguity.",
    learns: "The agent ranks likely fault domains and explains confidence with retrieved operational context.",
    demoLine: "The confidence is deterministic and explainable because it is grounded in MongoDB context.",
  },
  summary: {
    capability: "Auditable recommendations and follow-up memory",
    collections: ["investigation_cases", "owners", "interfaces"],
    queryPattern: "Persist the investigation summary, recommended checks, timeline, and follow-up Q&A to the case record.",
    learns: "The agent produces safe next checks and keeps a resumable investigation history.",
    demoLine: "MongoDB turns the agent run into an auditable case, not a one-off chat answer.",
  },
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
  const lifecycleStatus = alert.lifecycle_status || alert.lifecycle?.status || "new";
  return (
    <button type="button" className={`alert-card ${active ? "active" : ""}`} aria-current={active ? "true" : undefined} onClick={onClick}>
      <span className="alert-card-top">
        <span className={`badge status-${alert.status}`}>{alert.severity || "alert"}</span>
        <span className={`lifecycle-pill lifecycle-${lifecycleStatus}`}>{alert.lifecycle?.label || "New"}</span>
      </span>
      <strong>{alert.reason}</strong>
      <small>{alert.source_system} · {alert.interface_key}</small>
      {alert.business_process_name && <span className="process-tag">{alert.business_process_name}</span>}
      {alert.detail && <span className="alert-preview">{alert.detail}</span>}
    </button>
  );
}

function AlertGroup({ group, selectedKey, onSelect }) {
  return (
    <section className="alert-group">
      <div className="alert-group-head">
        <div>
          <span className="group-kicker">Business process</span>
          <h4>{group.name}</h4>
        </div>
        <span className="count-pill">{group.alerts.length}</span>
      </div>
      {group.alerts.map((alert) => (
        <AlertCard key={alert.key} alert={alert} active={alert.key === selectedKey} onClick={() => onSelect(alert.key)} />
      ))}
    </section>
  );
}

function GuidedPath({ steps }) {
  return (
    <ol className="guided-path" aria-label="Recommended investigation path">
      {steps.map((step, index) => (
        <li key={step.label} className={step.status}>
          <span className="guided-path-num">{index + 1}</span>
          <span><strong>{step.label}</strong><small>{step.detail}</small></span>
        </li>
      ))}
    </ol>
  );
}

function Timeline({ steps, selectedStageId, onSelectStage }) {
  const completeCount = steps.filter((step) => step.status === "complete").length;
  const runningStep = steps.find((step) => step.status === "running");
  const progress = Math.round((completeCount / steps.length) * 100);
  const stepById = new Map(steps.map((step) => [step.id, step]));
  const phases = PLAYBOOK_PHASES.map((phase) => {
    const phaseSteps = phase.stageIds.map((id) => stepById.get(id)).filter(Boolean);
    const phaseComplete = phaseSteps.every((step) => step.status === "complete");
    const phaseRunning = phaseSteps.some((step) => step.status === "running");
    const phaseSelected = phaseSteps.some((step) => step.id === selectedStageId);
    return {
      ...phase,
      steps: phaseSteps,
      status: phaseComplete ? "complete" : phaseRunning ? "running" : "pending",
      open: phaseSelected || phaseRunning,
    };
  });
  return (
    <section className="panel-card investigation-playbook">
      <div className="panel-title-row">
        <div>
          <h3>Investigation playbook</h3>
          <p className="muted mini-copy">Same supervised playbook for every alert; each step is grounded in case-specific MongoDB context.</p>
          <p className="muted mini-copy">{runningStep ? runningStep.detail : `${completeCount} of ${steps.length} checks complete`} · Expand a phase and click a check for MongoDB usage.</p>
        </div>
        <span className="progress-pill">{progress}%</span>
      </div>
      <div className="progress-track" aria-label="Investigation progress">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="playbook-phase-list">
        {phases.map((phase, phaseIndex) => (
          <details key={phase.id} className={`playbook-phase ${phase.status}`} open={phase.open}>
            <summary>
              <span className="phase-index">{phaseIndex + 1}</span>
              <span><strong>{phase.label}</strong><small>{phase.detail}</small></span>
              <StatusPill status={phase.status} />
            </summary>
            <div className="phase-step-list">
              {phase.steps.map((step) => (
                <button key={step.id} type="button" className={`phase-step ${step.status} ${step.id === selectedStageId ? "selected" : ""}`} aria-current={step.id === selectedStageId ? "step" : undefined} onClick={() => onSelectStage(step.id)}>
                  <span className="timeline-dot" />
                  <span>
                    <strong>{step.label}</strong>
                    <small>{step.detail}</small>
                  </span>
                </button>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function MongoStagePanel({ stageId, step, result }) {
  const stage = MONGODB_STAGE_EXPLANATIONS[stageId] || MONGODB_STAGE_EXPLANATIONS.received;
  const trace = result?.mongodb_trace?.[stageId];
  const collections = trace?.collections?.length ? trace.collections : stage.collections;
  const operations = trace?.operations || [];
  return (
    <section className="panel-card mongo-stage-panel">
      <div className="panel-title-row compact">
        <div>
          <span className="eyebrow">MongoDB usage</span>
          <h3>{step?.label || "Agent stage"}</h3>
        </div>
        {operations.length ? <span className="count-pill">Actual trace</span> : <StatusPill status={step?.status || "pending"} />}
      </div>
      <p className="stage-capability">{trace?.capability || stage.capability}</p>
      {operations.length > 0 && <p className="trace-helper">Shown as MongoDB shell-style syntax for readability; ODM/runtime details are intentionally omitted.</p>}
      <div className="collection-chip-row">
        {collections.map((collection) => <span key={collection}>{collection}</span>)}
      </div>
      <dl className="stage-details">
        <div>
          <dt>{operations.length ? "Raw MongoDB query" : "Query pattern"}</dt>
          <dd>
            {operations.length ? (
              <div className="query-list">
                {operations.map((operation, index) => (
                  <article key={`${operation.collection}-${operation.operation}-${index}`} className="query-snippet">
                    <span>{operation.operation} on {operation.collection}</span>
                    <pre>{operation.code}</pre>
                    {operation.purpose && <small>{operation.purpose}</small>}
                  </article>
                ))}
              </div>
            ) : stage.queryPattern}
          </dd>
        </div>
        <div><dt>Agent learns</dt><dd>{stage.learns}</dd></div>
        <div><dt>Why it matters</dt><dd>{stage.demoLine}</dd></div>
      </dl>
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
        <button key={item.key} type="button" className={`case-card ${activeCase?.key === item.key ? "active" : ""}`} onClick={() => onSelect(item.key)}>
          <strong>{item.alert_snapshot?.reason || "Investigation case"}</strong>
          <small>{item.top_fault_domain?.name || "Fault domain pending"} · {item.status}</small>
        </button>
      ))}
    </section>
  );
}

function SelectedAlertPanel({ alert, busy, lifecycleBusy, activeCase, isHiddenByFilters, onInvestigate, onLifecycleChange }) {
  if (!alert) {
    return (
      <section className="selected-alert-panel empty-card">
        <strong>No alert selected</strong>
        <p>Use the inbox filters, then choose an alert to start the agent workflow.</p>
      </section>
    );
  }

  const lifecycleStatus = alert.lifecycle_status || alert.lifecycle?.status || "new";
  const lifecycleActions = [
    { status: "acknowledged", label: "Acknowledge" },
    { status: "escalated", label: "Escalate" },
    { status: "resolved", label: "Resolve" },
    { status: "new", label: "Reopen" },
  ].filter((action) => action.status !== lifecycleStatus);

  return (
    <section className="selected-alert-panel">
      <span className="eyebrow">Selected alert</span>
      <span className="selected-alert-meta">
        <span className={`badge status-${alert.status}`}>{alert.severity || "alert"}</span>
        <span>{alert.status || "open"}</span>
        <span className={`lifecycle-pill lifecycle-${lifecycleStatus}`}>{alert.lifecycle?.label || "New"}</span>
      </span>
      <strong>{alert.reason}</strong>
      <small>{alert.source_system} · {alert.interface_key}</small>
      {isHiddenByFilters && <span className="saved-case-pill">Hidden by current filters</span>}
      {activeCase?.key && <span className="saved-case-pill">Saved case: {activeCase.key}</span>}
      <div className="lifecycle-actions" aria-label="Alert lifecycle actions">
        {lifecycleActions.map((action) => (
          <button key={action.status} type="button" disabled={busy || lifecycleBusy} onClick={() => onLifecycleChange(action.status)}>
            {action.label}
          </button>
        ))}
      </div>
      <small className="lifecycle-note">Demo-safe lifecycle only; no page, ticket, or remediation is sent.</small>
      <button type="button" className="primary full" disabled={busy} onClick={onInvestigate}>
        {busy ? "Investigating…" : activeCase?.key ? "Run fresh investigation" : "Open investigation case"}
      </button>
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
      {top?.reason && <p className="confidence-rationale">{top.reason}</p>}
      <div className="chip-row">
        {processes.map((p) => <span key={p.key} className="chip risk">{p.name}</span>)}
        {owners.map((o) => <span key={o.key} className="chip">{o.name}</span>)}
      </div>
    </section>
  );
}

function BusinessImpactPanel({ result, selectedAlert }) {
  const top = result?.likely_fault_domains?.[0];
  const processNames = (result?.impacted_business_processes || []).map((p) => p.name).join(", ");
  const ownerNames = (result?.owners || []).map((o) => o.name).join(", ");
  const affectedSystems = result?.affected_systems?.length || 0;
  const downstreamInterfaces = result?.topology?.downstream_interfaces?.length || 0;
  const firstAction = result?.recommended_next_actions?.[0];

  return (
    <section className="panel-card business-impact-card">
      <div className="panel-title-row compact">
        <div>
          <span className="eyebrow">Business impact</span>
          <h3>Impact summary</h3>
        </div>
        {result && <span className="count-pill">Ready</span>}
      </div>
      {!result && (
        <p className="muted">Investigate {selectedAlert ? `“${selectedAlert.reason}”` : "an alert"} to translate the signal into business impact.</p>
      )}
      {result && (
        <>
          <div className="impact-metric-grid">
            <div><span>Process</span><strong>{processNames || "No mapped process"}</strong></div>
            <div><span>Likely domain</span><strong>{top?.name || "Pending"}</strong></div>
            <div><span>Owner</span><strong>{ownerNames || "No mapped owner"}</strong></div>
            <div><span>Topology at risk</span><strong>{affectedSystems} systems · {downstreamInterfaces} interfaces</strong></div>
          </div>
          {firstAction && <div className="first-check"><span>Recommended first check</span><p>{firstAction}</p></div>}
        </>
      )}
    </section>
  );
}

function OperationalPriorityPanel({ selectedAlert, result }) {
  const priority = deriveOperationalPriority(selectedAlert, result);
  return (
    <section className={`panel-card operational-priority-card priority-${priority.level}`}>
      <div className="panel-title-row compact">
        <div>
          <span className="eyebrow">Operational priority</span>
          <h3>{priority.label}</h3>
        </div>
        <span className="count-pill">{priority.slaRisk}</span>
      </div>
      <p className="priority-summary">{priority.summary}</p>
      <div className="priority-grid">
        <div><span>Severity</span><strong>{priority.severity}</strong></div>
        <div><span>Status</span><strong>{priority.status}</strong></div>
        <div><span>Process</span><strong>{priority.process}</strong></div>
        <div><span>Owner</span><strong>{priority.owner}</strong></div>
        <div><span>Fault domain</span><strong>{priority.faultDomain}</strong></div>
        <div><span>First check</span><strong>{priority.firstCheck}</strong></div>
      </div>
      <p className="approval-guardrail">Read-only investigation. Remediation or escalation requires operator approval.</p>
    </section>
  );
}

function RelatedContextPanel({ result }) {
  const related = result?.related_context;
  const docs = related?.documents || [];
  return (
    <section className="panel-card related-context-panel">
      <div className="panel-title-row compact">
        <div>
          <span className="eyebrow">Related context</span>
          <h3>Runbooks and prior incidents</h3>
        </div>
        {related?.engine && <span className="count-pill">{related.engine}</span>}
      </div>
      {!result && <p className="muted">Related runbooks and incident notes appear after investigation.</p>}
      {related?.query && <p className="mini-copy muted">Query: {related.query}</p>}
      {docs.map((doc) => (
        <article key={doc.key} className="related-context-card">
          <span>{doc.type}</span>
          <strong>{doc.title}</strong>
          <p>{doc.snippet || doc.text}</p>
        </article>
      ))}
      {result && !docs.length && <p className="muted">No related context found for this alert.</p>}
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

function deriveOperationalPriority(alert, result) {
  if (!alert) {
    return {
      level: "none",
      label: "Select an alert",
      slaRisk: "Pending",
      summary: "Choose an inbox alert to derive operational priority from severity, status, ownership, and impact context.",
      severity: "—",
      status: "—",
      process: "—",
      owner: "—",
      faultDomain: "—",
      firstCheck: "Open an alert",
    };
  }

  const severity = alert.severity || "warning";
  const status = alert.status || "open";
  const top = result?.likely_fault_domains?.[0];
  const process = result?.impacted_business_processes?.[0]?.name || alert.business_process_name || "Open case to confirm";
  const owner = result?.owners?.[0]?.name || "Open case to identify";
  const firstCheck = result?.recommended_next_actions?.[0] || "Open investigation case for safe next checks";
  const failed = status === "failed";
  const critical = severity === "critical";
  const level = failed ? "critical" : critical ? "elevated" : "watch";
  const label = failed ? "Immediate triage" : critical ? "High priority" : "Monitor";
  const slaRisk = failed ? "SLA breach likely" : critical ? "SLA at risk" : "Watch";
  const summary = result
    ? `${process} is the priority context; start with ${owner} and verify ${top?.name || "the mapped fault domain"}.`
    : `${severity.toUpperCase()} ${status} alert selected. Open a case to calculate owner, impact, and first check.`;

  return {
    level,
    label,
    slaRisk,
    summary,
    severity,
    status,
    process,
    owner,
    faultDomain: top?.name || "Open case to rank",
    firstCheck,
  };
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
  if (q.includes("related") || q.includes("similar") || q.includes("runbook") || q.includes("incident")) return `Related context: ${(result.related_context?.documents || []).slice(0, 3).map((d) => d.title).join("; ") || "no matching runbooks or incident notes were found"}.`;
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

function groupAlertsByProcess(alerts) {
  const groupsByName = alerts.reduce((acc, alert) => {
    const name = alert.business_process_name || "Starting / unassigned alerts";
    if (!acc.has(name)) acc.set(name, []);
    acc.get(name).push(alert);
    return acc;
  }, new Map());

  return [...groupsByName.entries()]
    .map(([name, groupedAlerts]) => ({ name, alerts: groupedAlerts }))
    .sort((a, b) => {
      const ai = ALERT_GROUP_ORDER.indexOf(a.name);
      const bi = ALERT_GROUP_ORDER.indexOf(b.name);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.name.localeCompare(b.name);
    });
}

function mergeUpdatedAlert(alerts, updatedAlert) {
  if (!updatedAlert?.key) return alerts;
  return alerts.map((alert) => alert.key === updatedAlert.key ? updatedAlert : alert);
}

function processName(alert) {
  return alert.business_process_name || "Starting / unassigned alerts";
}

function sortProcessNames(a, b) {
  const ai = ALERT_GROUP_ORDER.indexOf(a);
  const bi = ALERT_GROUP_ORDER.indexOf(b);
  return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
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
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [feedStatus, setFeedStatus] = useState("");
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [cases, setCases] = useState([]);
  const [activeCase, setActiveCase] = useState(null);
  const [caseStatus, setCaseStatus] = useState("");
  const [selectedStageId, setSelectedStageId] = useState("received");
  const [alertQuery, setAlertQuery] = useState("");
  const [processFilter, setProcessFilter] = useState(PROCESS_FILTER_ALL);

  const selectedAlert = useMemo(() => alerts.find((a) => a.key === selectedKey), [alerts, selectedKey]);
  const processOptions = useMemo(() => {
    const counts = alerts.reduce((acc, alert) => acc.set(processName(alert), (acc.get(processName(alert)) || 0) + 1), new Map());
    return [{ name: PROCESS_FILTER_ALL, count: alerts.length }, ...[...counts.entries()].sort(([a], [b]) => sortProcessNames(a, b)).map(([name, count]) => ({ name, count }))];
  }, [alerts]);
  const filteredAlerts = useMemo(() => alerts.filter((alert) => {
    const matchesProcess = processFilter === PROCESS_FILTER_ALL || processName(alert) === processFilter;
    const haystack = [alert.reason, alert.detail, alert.source_system, alert.interface_key, alert.severity, alert.status, alert.lifecycle?.label, alert.lifecycle_status, processName(alert)].filter(Boolean).join(" ").toLowerCase();
    return matchesProcess && haystack.includes(alertQuery.trim().toLowerCase());
  }), [alerts, alertQuery, processFilter]);
  const alertGroups = useMemo(() => groupAlertsByProcess(filteredAlerts), [filteredAlerts]);
  const hiddenAlertCount = alerts.length - filteredAlerts.length;
  const selectedAlertVisible = useMemo(() => filteredAlerts.some((alert) => alert.key === selectedKey), [filteredAlerts, selectedKey]);
  const selectedStage = useMemo(() => steps.find((step) => step.id === selectedStageId) || steps[0], [selectedStageId, steps]);
  const hasEnterpriseContext = useMemo(() => alerts.some((alert) => alert.source_system === "alertmanager-webhook"), [alerts]);
  const guidedPath = useMemo(() => [
    {
      label: "Replay context",
      detail: hasEnterpriseContext ? "External alerts loaded" : "Load Alertmanager + catalog + CMDB records",
      status: hasEnterpriseContext ? "complete" : "active",
    },
    {
      label: "Select alert",
      detail: selectedAlert ? selectedAlert.business_process_name || selectedAlert.interface_key : "Choose an inbox item",
      status: selectedAlert ? "complete" : hasEnterpriseContext ? "active" : "pending",
    },
    {
      label: "Open case",
      detail: activeCase ? activeCase.key : "Create an auditable investigation",
      status: activeCase ? "complete" : selectedAlert ? "active" : "pending",
    },
    {
      label: "Review evidence",
      detail: result ? "Impact, topology, related context ready" : "Follow the agent timeline",
      status: result ? "complete" : activeCase ? "active" : "pending",
    },
  ], [activeCase, hasEnterpriseContext, result, selectedAlert]);

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
    setSelectedStageId(id);
    setSteps((current) => current.map((s) => s.id === id ? { ...s, status, detail: detail || s.detail } : s));
  };

  const selectAlert = (key) => {
    setSelectedKey(key);
    setActiveCase(null);
    setResult(null);
    setImpacted(null);
    setMessages([]);
    setSelectedStageId("received");
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
      setSelectedStageId("summary");
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
      setAlerts((current) => mergeUpdatedAlert(current, investigation.alert));
      setActiveCase(nextCase);
      setCaseStatus(`Case ${nextCase.key} opened; alert marked investigating.`);
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

      mark("related", "running", "Searching related runbooks and incident notes.");
      mark("related", "complete", `${investigation.related_context?.documents?.length || 0} related context items retrieved.`);
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
    } catch (err) {
      setCaseStatus(err.message || "Unable to complete investigation.");
      setSteps(STEP_TEMPLATE.map((s) => ({ ...s, status: "pending" })));
    } finally {
      setBusy(false);
    }
  };

  const updateLifecycle = async (status) => {
    if (!selectedAlert) return;
    setLifecycleBusy(true);
    try {
      const res = await api.updateAlertLifecycle(selectedAlert.key, { status });
      setAlerts((current) => mergeUpdatedAlert(current, res.alert));
      setFeedStatus(`Alert lifecycle updated to ${res.alert.lifecycle?.label || status}.`);
    } catch (err) {
      setFeedStatus(err.message || "Unable to update alert lifecycle.");
    } finally {
      setLifecycleBusy(false);
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

  const loadScriptedDemoAlerts = async () => {
    setFeedBusy(true);
    setFeedStatus("Loading scripted demo alerts for rehearsal…");
    try {
      const res = await api.ingestDemoAlerts();
      setAlerts(res.alerts || []);
      setSelectedKey((current) => (res.alerts || []).some((alert) => alert.key === current) ? current : res.alerts?.[0]?.key || "");
      const refreshed = Math.max((res.upserted_alerts || 0) - (res.inserted_alerts || 0), 0);
      setFeedStatus(
        res.inserted_alerts
          ? `${res.inserted_alerts} scripted demo alerts loaded for rehearsal.`
          : `${refreshed} scripted demo alerts refreshed; inbox is up to date.`
      );
    } catch (err) {
      setFeedStatus(err.message || "Unable to load scripted demo alerts.");
    } finally {
      setFeedBusy(false);
    }
  };

  const ingestEnterpriseContext = async () => {
    setFeedBusy(true);
    setFeedStatus("Capturing enterprise fixture records and refreshing the inbox…");
    try {
      const loaded = await api.loadEnterpriseFixtures();
      const normalized = await api.runIngestion();
      const res = await api.alerts();
      const nextAlerts = res.alerts || [];
      const externalAlerts = nextAlerts.filter((alert) => alert.source_system === "alertmanager-webhook");
      setAlerts(nextAlerts);
      setProcessFilter(PROCESS_FILTER_ALL);
      setAlertQuery("");
      setSelectedKey(externalAlerts[0]?.key || nextAlerts[0]?.key || "");
      setActiveCase(null);
      setResult(null);
      setImpacted(null);
      setMessages([]);
      setSelectedStageId("received");
      setSteps(STEP_TEMPLATE.map((s) => ({ ...s, status: "pending" })));
      setFeedStatus(
        `${externalAlerts.length} external Alertmanager alerts added from ${loaded.source_records_loaded} source records; ` +
        `${normalized.relationship_upserts} relationships and ${normalized.event_upserts} events normalized.`
      );
    } catch (err) {
      setFeedStatus(err.message || "Unable to ingest enterprise context pack.");
    } finally {
      setFeedBusy(false);
    }
  };

  const clearDemoState = async () => {
    setResetBusy(true);
    setFeedStatus("Clearing simulated alerts, enterprise fixtures, and case memory…");
    try {
      const fixtureClear = await api.clearEnterpriseFixtures();
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
      setSelectedStageId("received");
      setSteps(STEP_TEMPLATE.map((s) => ({ ...s, status: "pending" })));
      setFeedStatus(`${res.deleted_feed_alerts} demo feed alerts and ${fixtureClear.deleted_source_records} enterprise fixture records cleared; ${res.deleted_cases} cases removed.`);
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
          <strong>Recommended flow</strong>
          <GuidedPath steps={guidedPath} />
        </div>
        <div className={`replay-card ${hasEnterpriseContext ? "ready" : ""}`}>
          <strong>{hasEnterpriseContext ? "Enterprise context is loaded" : "Start here"}</strong>
          <p>{hasEnterpriseContext ? "External Alertmanager alerts are available in the inbox." : "Replay enterprise context to load raw Alertmanager, catalog, and CMDB records into the inbox."}</p>
          <button type="button" className="primary" disabled={feedBusy || resetBusy || busy} onClick={ingestEnterpriseContext}>{feedBusy ? "Replaying…" : "Replay enterprise context"}</button>
        </div>
        <details className="sidebar-disclosure demo-controls">
          <summary>Demo controls</summary>
          <div className="alert-inbox-actions">
            <button type="button" disabled={feedBusy || resetBusy || busy} onClick={loadScriptedDemoAlerts}>{feedBusy ? "Loading…" : "Add extra demo alerts"}</button>
            <button type="button" className="danger" disabled={feedBusy || resetBusy || busy} onClick={clearDemoState}>{resetBusy ? "Resetting…" : "Reset demo"}</button>
          </div>
          <p className="feed-status">Reset clears enterprise fixtures, scripted demo alerts, and case memory.</p>
        </details>
        <p className="feed-status">{feedStatus || "Enterprise context is the primary demo path. Extra scripted alerts are optional rehearsal data."}</p>
        <div className="alert-inbox-head">
          <h3>Alert inbox</h3>
          <span className="count-pill">{alerts.length}</span>
        </div>
        <SelectedAlertPanel alert={selectedAlert} busy={busy} lifecycleBusy={lifecycleBusy} activeCase={activeCase} isHiddenByFilters={Boolean(selectedAlert && !selectedAlertVisible)} onInvestigate={startInvestigation} onLifecycleChange={updateLifecycle} />
        <details className="sidebar-disclosure">
          <summary>Filter alerts <span>{hiddenAlertCount ? `${hiddenAlertCount} hidden` : "optional"}</span></summary>
          <div className="inbox-filter-panel">
            <label>
              <span>Search alerts</span>
              <input value={alertQuery} onChange={(e) => setAlertQuery(e.target.value)} placeholder="Reason, source, interface…" />
            </label>
            <div className="process-filter-row" aria-label="Filter by business process">
              {processOptions.map((option) => (
                <button key={option.name} type="button" className={processFilter === option.name ? "active" : ""} onClick={() => setProcessFilter(option.name)}>
                  {option.name}<span>{option.count}</span>
                </button>
              ))}
            </div>
            {hiddenAlertCount > 0 && <small>{hiddenAlertCount} alert{hiddenAlertCount === 1 ? "" : "s"} hidden by filters.</small>}
          </div>
        </details>
        {!filteredAlerts.length && <div className="empty-card"><strong>No matching alerts</strong><p>Clear the search or switch process filters to see more alerts.</p></div>}
        {alertGroups.map((group) => (
          <AlertGroup key={group.name} group={group} selectedKey={selectedKey} onSelect={selectAlert} />
        ))}
        <details className="sidebar-disclosure case-history">
          <summary>Case memory <span>{cases.length}</span></summary>
          <p className="feed-status">{caseStatus || "Stores investigation history and grounded follow-up."}</p>
          <CaseMemory cases={cases} activeCase={activeCase} onSelect={selectCase} />
        </details>
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
                <span>{selectedAlert.lifecycle?.label || "New"}</span>
                {activeCase?.key && <span>Saved as {activeCase.key}</span>}
              </div>
            )}
          </div>
          <div className="case-stats">
            <Stat label="Severity" value={selectedAlert?.severity || "—"} />
            <Stat label="Ranking confidence" value={result?.likely_fault_domains?.[0] ? pct(result.likely_fault_domains[0].score) : busy ? "Building" : "—"} />
            <Stat label="Evidence" value={result?.evidence?.length ?? "—"} />
          </div>
        </section>

        <div className="workbench-grid">
          <div className="workbench-center">
            <Timeline steps={steps} selectedStageId={selectedStageId} onSelectStage={setSelectedStageId} />
            <MongoStagePanel stageId={selectedStageId} step={selectedStage} result={result} />
            <section className="panel-card workbench-graph">
              <h3>Topology impact graph</h3>
              <DependencyGraph flow={flow} impacted={impacted} />
            </section>
          </div>

          <aside className="workbench-right">
            <OperationalPriorityPanel selectedAlert={selectedAlert} result={result} />
            <SummaryPanel result={result} />
            <BusinessImpactPanel result={result} selectedAlert={selectedAlert} />
            <RelatedContextPanel result={result} />
            <CaseTimeline caseRecord={activeCase} />
            <EvidencePanel result={result} />
            <FollowUpPanel result={result} messages={messages} question={question} setQuestion={setQuestion} onAsk={ask} />
          </aside>
        </div>
      </main>
    </div>
  );
}