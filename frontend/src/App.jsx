import { useState } from "react";
import Explorer from "./components/Explorer.jsx";
import InvestigationWorkbench from "./components/InvestigationWorkbench.jsx";
import DemoConsole from "./components/DemoConsole.jsx";
import Modernization from "./components/Modernization.jsx";
import Ingestion from "./components/Ingestion.jsx";
import Investigation from "./components/Investigation.jsx";

const NAV_ITEMS = [
  { id: "workbench", label: "Investigation Workbench", hint: "Recommended demo path" },
  { id: "demo", label: "Presenter Console", hint: "Guided walkthrough controls" },
  { id: "explorer", label: "Catalog Explorer", hint: "Underlying context graph" },
  { id: "modernization", label: "Modernization", hint: "Planning impact analysis" },
  { id: "ingestion", label: "Context Ingestion", hint: "How source records become context" },
  { id: "investigation", label: "Classic Investigation", hint: "Earlier read-only investigation view" },
];

export default function App() {
  const [tab, setTab] = useState("workbench");

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="dot" />
          <div>
            <h1>Find the Failure</h1>
            <span className="muted">Apex Health Supply · EDI Integration Impact Explorer</span>
            <span className="hero-hint">Recommended path: start in Investigation Workbench</span>
          </div>
        </div>
        <div className="header-meta">
          <span className="scope-pill">Bounded Agent v1 PoC</span>
          <nav className="tabs" aria-label="Application views">
            {NAV_ITEMS.map((item) => (
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
          </nav>
        </div>
      </header>
      {tab === "workbench" && <InvestigationWorkbench />}
      {tab === "demo" && <DemoConsole />}
      {tab === "explorer" && <Explorer />}
      {tab === "modernization" && <Modernization />}
      {tab === "ingestion" && <Ingestion />}
      {tab === "investigation" && <Investigation />}
    </div>
  );
}
