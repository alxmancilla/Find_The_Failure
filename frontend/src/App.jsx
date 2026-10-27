import { useState } from "react";
import Explorer from "./components/Explorer.jsx";
import InvestigationWorkbench from "./components/InvestigationWorkbench.jsx";
import DemoConsole from "./components/DemoConsole.jsx";
import Modernization from "./components/Modernization.jsx";
import Ingestion from "./components/Ingestion.jsx";
import Investigation from "./components/Investigation.jsx";
import RecallTrace from "./components/RecallTrace.jsx";

const NAV_GROUPS = [
  { label: "Operations", items: [{ id: "workbench", label: "Investigation Workbench", hint: "Alert to impact, owner, and safe next check" }] },
  {
    label: "Architecture",
    items: [
      { id: "explorer", label: "Catalog & Lineage", hint: "Dependency graph and data lineage for order-to-cash and procure-to-pay" },
      { id: "modernization", label: "Modernization", hint: "What breaks, and what must be rebuilt, if a system changes" },
      { id: "recall", label: "Recall Trace", hint: "Trace a recalled lot across procure-to-pay and order-to-cash" },
    ],
  },
  { label: "Platform", items: [{ id: "ingestion", label: "Context Ingestion", hint: "How source records become trusted context" }] },
];

const MORE_ITEMS = [
  { id: "demo", label: "Presenter Console" },
  { id: "investigation", label: "Classic Investigation" },
];

export default function App() {
  const [tab, setTab] = useState("workbench");
  const [modernizationSystem, setModernizationSystem] = useState("x12-translator");
  const [catalogTarget, setCatalogTarget] = useState(null);
  const [workbenchFocus, setWorkbenchFocus] = useState(null);
  const goTo = (id) => {
    setCatalogTarget(null);
    setWorkbenchFocus(null);
    setTab(id);
  };
  const planChange = (systemKey) => {
    setModernizationSystem(systemKey);
    goTo("modernization");
  };
  const openLineage = (target) => {
    goTo("explorer");
    setCatalogTarget({ ...target, nonce: Date.now() });
  };
  const investigateInterface = (interfaceKey, context) => {
    goTo("workbench");
    setWorkbenchFocus({ interfaceKey, context, nonce: Date.now() });
  };

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="dot" />
          <div>
            <h1>Find the Failure</h1>
            <span className="muted">Apex Health Supply · EDI Integration Impact Explorer</span>
            <span className="hero-hint">Operations: Workbench · Architecture: Catalog & Lineage → Modernization → Recall Trace</span>
          </div>
        </div>
        <div className="header-meta">
          <span className="scope-pill">Bounded Agent v1 PoC</span>
          <nav className="tabs" aria-label="Application views">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="nav-group" role="group" aria-label={group.label}>
                <span className="nav-group-label">{group.label}</span>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    className={tab === item.id ? "active" : ""}
                    aria-pressed={tab === item.id}
                    title={item.hint}
                    onClick={() => goTo(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
            <select
              className={`nav-more ${MORE_ITEMS.some((item) => item.id === tab) ? "active" : ""}`}
              aria-label="More views"
              value={MORE_ITEMS.some((item) => item.id === tab) ? tab : ""}
              onChange={(e) => e.target.value && goTo(e.target.value)}
            >
              <option value="">More…</option>
              {MORE_ITEMS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </nav>
        </div>
      </header>
      {tab === "workbench" && <InvestigationWorkbench focus={workbenchFocus} />}
      {tab === "demo" && <DemoConsole />}
      {tab === "explorer" && <Explorer key={catalogTarget?.nonce || "explorer"} target={catalogTarget} onPlanChange={planChange} onInvestigate={investigateInterface} />}
      {tab === "modernization" && <Modernization systemKey={modernizationSystem} onSystemChange={setModernizationSystem} onOpenLineage={openLineage} />}
      {tab === "recall" && <RecallTrace onOpenLineage={openLineage} />}
      {tab === "ingestion" && <Ingestion />}
      {tab === "investigation" && <Investigation />}
    </div>
  );
}
