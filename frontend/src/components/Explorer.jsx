import { useState, useEffect, useCallback } from "react";
import SearchBar from "./SearchBar.jsx";
import DependencyGraph from "./DependencyGraph.jsx";
import InterfaceDetails from "./InterfaceDetails.jsx";
import { api } from "../api.js";

export default function Explorer() {
  const [flow, setFlow] = useState(null);
  const [detail, setDetail] = useState(null);
  const [impact, setImpact] = useState(null);
  const [impacted, setImpacted] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.scenarios().then(setScenarios).catch(() => {});
  }, []);

  const loadDetail = useCallback(async (key) => {
    setDetail(await api.interface(key));
  }, []);

  const selectFromSearch = useCallback(async (key) => {
    setImpact(null);
    setImpacted(null);
    const f = await api.flow(key);
    setFlow(f);
    await loadDetail(key);
  }, [loadDetail]);

  const buildImpacted = (imp) => ({
    failedEdges: [imp.interface.key],
    failedSystems: [imp.interface.target],
    riskEdges: (imp.downstream_interfaces || []).map((i) => i.key),
    riskSystems: (imp.affected_systems || [])
      .map((s) => s.key)
      .filter((k) => k !== imp.interface.target),
  });

  const simulate = useCallback(async (key) => {
    setBusy(true);
    try {
      const imp = await api.simulate(key, {
        reason: "ERP endpoint timeout",
        detail: "Simulated: order rejected because the ERP endpoint timed out.",
      });
      setImpact(imp);
      setImpacted(buildImpacted(imp));
      await loadDetail(key);
    } finally {
      setBusy(false);
    }
  }, [loadDetail]);

  const reset = useCallback(async () => {
    setBusy(true);
    try {
      await api.reset();
      setImpact(null);
      setImpacted(null);
      if (detail) await loadDetail(detail.key);
      if (flow) setFlow(await api.flow(flow.startKey));
    } finally {
      setBusy(false);
    }
  }, [detail, flow, loadDetail]);

  const selectSystem = useCallback((systemKey) => {
    if (!flow) return;
    const iface =
      flow.interfaces.find((i) => i.target === systemKey) ||
      flow.interfaces.find((i) => i.source === systemKey);
    if (iface) loadDetail(iface.key);
  }, [flow, loadDetail]);

  const runScenario = useCallback(async (id) => {
    setBusy(true);
    try {
      const res = await api.runScenario(id);
      setFlow(res.flow);
      setImpact(res.impact);
      setImpacted(buildImpacted(res.impact));
      await loadDetail(res.impact.interface.key);
    } finally {
      setBusy(false);
    }
  }, [loadDetail]);

  return (
    <div className="main">
      <div className="left">
        <SearchBar onSelectInterface={selectFromSearch} />
        {scenarios.length > 0 && (
          <div className="scenario-bar">
            <span className="scenario-label">Failure scenarios:</span>
            {scenarios.map((s) => (
              <button
                key={s.id}
                className="scenario-btn"
                disabled={busy}
                title={s.description}
                onClick={() => runScenario(s.id)}
              >
                {s.name}
              </button>
            ))}
            <button className="scenario-reset" disabled={busy} onClick={reset}>
              Reset
            </button>
          </div>
        )}
        <DependencyGraph
          flow={flow}
          impacted={impacted}
          onSelectSystem={selectSystem}
          onSelectInterface={loadDetail}
        />
      </div>
      <aside className="right">
        <InterfaceDetails
          detail={detail}
          impact={impact && detail && impact.interface.key === detail.key ? impact : null}
          onSimulate={simulate}
          onReset={reset}
          busy={busy}
        />
      </aside>
    </div>
  );
}
