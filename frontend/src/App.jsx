import { useState } from "react";
import Explorer from "./components/Explorer.jsx";
import InvestigationWorkbench from "./components/InvestigationWorkbench.jsx";
import DemoConsole from "./components/DemoConsole.jsx";
import Modernization from "./components/Modernization.jsx";
import Ingestion from "./components/Ingestion.jsx";
import Investigation from "./components/Investigation.jsx";

export default function App() {
  const [tab, setTab] = useState("workbench");

  return (
    <div className="app">
      <header className="header">
        <span className="dot" />
        <h1>Find the Failure</h1>
        <span className="muted">EDI Integration Impact Explorer</span>
        <nav className="tabs">
          <button
            className={tab === "workbench" ? "active" : ""}
            onClick={() => setTab("workbench")}
          >
            Investigation Workbench
          </button>
          <button
            className={tab === "demo" ? "active" : ""}
            onClick={() => setTab("demo")}
          >
            Demo Console
          </button>
          <button
            className={tab === "explorer" ? "active" : ""}
            onClick={() => setTab("explorer")}
          >
            Impact Explorer
          </button>
          <button
            className={tab === "modernization" ? "active" : ""}
            onClick={() => setTab("modernization")}
          >
            Modernization
          </button>
          <button
            className={tab === "ingestion" ? "active" : ""}
            onClick={() => setTab("ingestion")}
          >
            Ingestion
          </button>
          <button
            className={tab === "investigation" ? "active" : ""}
            onClick={() => setTab("investigation")}
          >
            Investigation
          </button>
        </nav>
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
