import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function SearchBar({ onSelectInterface }) {
  const [q, setQ] = useState("Hospital 123");
  const [results, setResults] = useState(null);

  useEffect(() => {
    if (!q.trim()) return setResults(null);
    const t = setTimeout(async () => {
      try {
        setResults(await api.search(q));
      } catch {
        setResults(null);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const pick = (key) => {
    setResults(null);
    onSelectInterface(key);
  };

  return (
    <div className="searchbar">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by system, interface, protocol, message type, or owner…"
        autoFocus
      />
      {results && (
        <div className="results">
          {results.engine === "atlas-search" && (
            <div className="engine-tag">⚡ Atlas Search · fuzzy · relevance-ranked</div>
          )}
          {results.interfaces?.length > 0 && (
            <div className="result-group">
              <h4>Interfaces</h4>
              {results.interfaces.map((i) => (
                <div key={i.key} className="result" onClick={() => pick(i.key)}>
                  <span className={`badge status-${i.last_status}`}>{i.last_status}</span>
                  <strong>{i.name}</strong>
                  <span className="badge">{i.protocol}</span>
                  <span className="muted">{i.source} → {i.target}</span>
                </div>
              ))}
            </div>
          )}
          {results.systems?.length > 0 && (
            <div className="result-group">
              <h4>Systems</h4>
              {results.systems.map((s) => (
                <div key={s.key} className="result">
                  <span className="badge">{s.kind}</span>
                  <strong>{s.name}</strong>
                  <span className="muted">{s.vendor}</span>
                </div>
              ))}
            </div>
          )}
          {results.owners?.length > 0 && (
            <div className="result-group">
              <h4>Owners</h4>
              {results.owners.map((o) => (
                <div key={o.key} className="result">
                  <strong>{o.name}</strong>
                  <span className="muted">{o.team}</span>
                </div>
              ))}
            </div>
          )}
          {!results.interfaces?.length &&
            !results.systems?.length &&
            !results.owners?.length && <div className="muted">No matches.</div>}
        </div>
      )}
    </div>
  );
}
