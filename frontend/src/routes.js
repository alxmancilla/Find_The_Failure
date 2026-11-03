// Hash routes: URL path segment -> view id used in App.jsx.
const VIEWS = {
  workbench: "workbench",
  lineage: "explorer",
  modernization: "modernization",
  recall: "recall",
  ingestion: "ingestion",
  presenter: "demo",
};
const PATHS = Object.fromEntries(Object.entries(VIEWS).map(([path, view]) => [view, path]));

export const DEFAULT_VIEW = "workbench";

export function parseHash(hash = "") {
  const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
  if (!VIEWS[path]) return { view: DEFAULT_VIEW, params: {} };
  return { view: VIEWS[path], params: Object.fromEntries(new URLSearchParams(query)) };
}

export function buildHash(view, params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
  return `#/${PATHS[view] || PATHS[DEFAULT_VIEW]}${query ? `?${query}` : ""}`;
}
