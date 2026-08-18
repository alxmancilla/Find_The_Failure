import { useState } from "react";
import Explorer from "./components/Explorer.jsx";
import Modernization from "./components/Modernization.jsx";

export default function App() {
  const [tab, setTab] = useState("explorer");

  return (
    <div className="app">
      <header className="header">
        <span className="dot" />
        <h1>Find the Failure</h1>
        <span className="muted">EDI Integration Impact Explorer</span>
        <nav className="tabs">
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
        </nav>
      </header>
      {tab === "explorer" ? <Explorer /> : <Modernization />}
    </div>
  );
}
