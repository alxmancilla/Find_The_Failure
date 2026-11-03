import { useEffect, useState } from "react";
import Explorer from "./components/Explorer.jsx";
import InvestigationWorkbench from "./components/InvestigationWorkbench.jsx";
import DemoConsole from "./components/DemoConsole.jsx";
import Modernization from "./components/Modernization.jsx";
import Ingestion from "./components/Ingestion.jsx";
import RecallTrace from "./components/RecallTrace.jsx";
import { buildHash, parseHash } from "./routes.js";

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

const MORE_ITEMS = [{ id: "demo", label: "Presenter Console" }];
const DEFAULT_SYSTEM = "x12-translator";

export default function App() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const navigate = (view, params) => {
    const next = buildHash(view, params);
    if (window.location.hash !== next) window.location.hash = next;
    setRoute(parseHash(next));
  };

  const { view: tab, params } = route;
  const catalogTarget = tab === "explorer" && (params.flow || params.entity || params.transaction)
    ? { flow: params.flow, entity: params.entity, transaction: params.transaction }
    : null;
  const workbenchFocus = tab === "workbench" && params.interface ? { interfaceKey: params.interface, context: params.from } : null;
  const goTo = (id) => navigate(id);
  const planChange = (systemKey) => navigate("modernization", { system: systemKey });
  const openLineage = (target) => navigate("explorer", { flow: target.flow, entity: target.entity, transaction: target.transaction });
  const investigateInterface = (interfaceKey, context) => navigate("workbench", { interface: interfaceKey, from: context });

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
      {tab === "workbench" && <InvestigationWorkbench key={params.interface || "workbench"} focus={workbenchFocus} />}
      {tab === "demo" && <DemoConsole />}
      {tab === "explorer" && <Explorer key={catalogTarget ? JSON.stringify(catalogTarget) : "explorer"} target={catalogTarget} onPlanChange={planChange} onInvestigate={investigateInterface} />}
      {tab === "modernization" && <Modernization systemKey={params.system || DEFAULT_SYSTEM} onSystemChange={(system) => navigate("modernization", { system })} onOpenLineage={openLineage} />}
      {tab === "recall" && <RecallTrace recallKey={params.notice || ""} onRecallChange={(notice) => navigate("recall", { notice })} onOpenLineage={openLineage} />}
      {tab === "ingestion" && <Ingestion />}
    </div>
  );
}
