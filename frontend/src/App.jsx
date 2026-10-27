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
      { id: "explorer", label: "Catalog & Lineage", hint: "Dependency graph and order-to-cash data lineage" },
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
  const planChange = (systemKey) => {
    setModernizationSystem(systemKey);
    setTab("modernization");
  };

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="dot" />
          <div>
            <h1>Find the Failure</h1>
            <span className="muted">Apex Health Supply · EDI Integration Impact Explorer</span>
            <span className="hero-hint">Operations: Workbench · Architecture: Catalog & Lineage → Modernization</span>
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
                    onClick={() => setTab(item.id)}
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
              onChange={(e) => e.target.value && setTab(e.target.value)}
            >
              <option value="">More…</option>
              {MORE_ITEMS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </nav>
        </div>
      </header>
      {tab === "workbench" && <InvestigationWorkbench />}
      {tab === "demo" && <DemoConsole />}
      {tab === "explorer" && <Explorer onPlanChange={planChange} />}
      {tab === "modernization" && <Modernization systemKey={modernizationSystem} onSystemChange={setModernizationSystem} />}
      {tab === "recall" && <RecallTrace />}
      {tab === "ingestion" && <Ingestion />}
      {tab === "investigation" && <Investigation />}
    </div>
  );
}
