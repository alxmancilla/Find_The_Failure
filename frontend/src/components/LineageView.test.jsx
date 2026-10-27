import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import LineageView from "./LineageView.jsx";
import { Segmented } from "./LineageGovernance.jsx";
import { api } from "../api.js";

vi.mock("../api.js", () => ({ api: {} }));
vi.mock("./DependencyGraph.jsx", () => ({
  IMPACT_LEGEND: [],
  default: ({ flow, emptyText, onSelectInterface }) => (flow
    ? <div>{flow.edges.map((e) => <button key={e.id} type="button" onClick={() => onSelectInterface(e.id)}>edge {e.id}</button>)}</div>
    : <p>{emptyText}</p>),
}));

const transformation = (key, confirmed) => ({
  key, from_key: "purchase-order", to_key: "canonical-order", confirmed, confidence: confirmed ? 1 : 0.6,
  source_system: "catalog", transformation: "Parse the 850", field_mappings: [], evidence: [], owners: [], via: [],
});

const lineage = {
  entity: { key: "purchase-order", name: "Purchase Order", identifiers: ["po_number"] },
  entities: [{ key: "purchase-order", name: "Purchase Order" }, { key: "canonical-order", name: "Canonical Order" }],
  data_quality: { confirmed: 1, inferred: 1, average_confidence: 0.8 },
  transformations: [transformation("t1", true), transformation("t2", false)],
  graph: { nodes: [], edges: [{ id: "t1" }, { id: "t2" }] },
  summary: "Purchase Order lineage",
  mongodb_trace: { collection: "relationships", purpose: "Traverse transforms_to", pipeline: [] },
};

const step = (n, key, mapped) => ({
  step: n, interface: { key, name: `Hop ${n}` }, from_system: { name: "A" }, to_system: { name: "B" },
  identifier_mapping: mapped ? { target_path: "BEG03" } : null, mapping_version: "v1",
});
const flow = { flow: "order-to-cash", identifier: "po_number", identifier_label: "PO number", summary: "Design path", steps: [step(1, "if-a", true), step(2, "if-b", false)] };

beforeEach(() => {
  Object.assign(api, {
    lineageFlows: vi.fn().mockResolvedValue({ flows: [{ key: "order-to-cash", name: "Order to Cash" }] }),
    lineageEntities: vi.fn().mockResolvedValue({ entities: lineage.entities }),
    lineageFlow: vi.fn().mockResolvedValue(flow),
    lineage: vi.fn().mockResolvedValue(lineage),
    lineageTransactions: vi.fn().mockResolvedValue({ transactions: [{ value: "PO-1", status: "failed" }] }),
    lineageTransaction: vi.fn().mockResolvedValue({
      value: "PO-1", summary: "PO-1 failed at Hop 2", steps: [], stuck_at: { interface: { key: "if-b", name: "Hop 2" } }, data_impact: null,
    }),
    lineageReviews: vi.fn().mockResolvedValue({ reviews: [] }),
    lineageMetamodel: vi.fn().mockResolvedValue(null),
  });
});
afterEach(cleanup);

describe("LineageView", () => {
  it("leads with an answer line built from lineage and flow coverage", async () => {
    render(<LineageView lens="data" onLensChange={() => {}} />);
    expect(await screen.findByText("✓ 1 confirmed")).toBeTruthy();
    expect(screen.getByText("⚠ 1 inferred · needs review")).toBeTruthy();
    expect(screen.getByText("PO number on 1/2 hops")).toBeTruthy();
    expect(screen.getByText(/1 connected document$/)).toBeTruthy();
  });

  it("counts inferred edges on the Governance tab and returns to Details when an edge is clicked", async () => {
    render(<LineageView lens="data" onLensChange={() => {}} />);
    const governance = await screen.findByRole("tab", { name: /Governance/ });
    await waitFor(() => expect(governance.textContent).toContain("1"));
    fireEvent.click(governance);
    expect(governance.getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByText("edge t2"));
    expect(screen.getByRole("tab", { name: "Details" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Purchase Order → Canonical Order")).toBeTruthy();
    expect(screen.getByText("Data steward review")).toBeTruthy();
  });

  it("opens a linked order in the Trace tab and links the stuck hop to the Workbench", async () => {
    const onInvestigate = vi.fn();
    render(<LineageView lens="data" onLensChange={() => {}} target={{ flow: "order-to-cash", entity: "purchase-order", transaction: "PO-1" }} onInvestigate={onInvestigate} />);
    expect(screen.getByRole("tab", { name: "Trace" }).getAttribute("aria-selected")).toBe("true");
    await waitFor(() => expect(api.lineageTransaction).toHaveBeenCalledWith("PO-1", "order-to-cash"));
    fireEvent.click(await screen.findByRole("button", { name: /Investigate Hop 2 in the Workbench/ }));
    expect(onInvestigate).toHaveBeenCalledWith("if-b", "PO-1");
  });

  it("shows a retry notice when loading fails and recovers on Retry", async () => {
    api.lineageEntities.mockRejectedValueOnce(new Error("Failed to fetch"));
    render(<LineageView lens="data" onLensChange={() => {}} />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("✓ 1 confirmed")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows a banner while viewing mappings as of a past date", async () => {
    const { container } = render(<LineageView lens="data" onLensChange={() => {}} />);
    await screen.findByText("✓ 1 confirmed");
    fireEvent.change(container.querySelector('input[type="date"]'), { target: { value: "2025-01-01" } });
    expect(await screen.findByText(/Viewing mappings as of/)).toBeTruthy();
    await waitFor(() => expect(api.lineage).toHaveBeenLastCalledWith("purchase-order", "both", "2025-01-01", "order-to-cash"));
    fireEvent.click(screen.getByRole("button", { name: "Back to current" }));
    expect(screen.queryByText(/Viewing mappings as of/)).toBeNull();
  });
});

describe("Segmented", () => {
  function Harness() {
    const [value, setValue] = useState("a");
    return <Segmented label="Direction" options={[{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }]} value={value} onChange={setValue} />;
  }

  it("moves selection and focus with arrow keys and wraps around", () => {
    render(<Harness />);
    const radio = (name) => screen.getByRole("radio", { name });
    fireEvent.keyDown(radio("A"), { key: "ArrowRight" });
    expect(radio("B").getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(radio("B"));
    fireEvent.keyDown(radio("B"), { key: "ArrowLeft" });
    fireEvent.keyDown(radio("A"), { key: "ArrowLeft" });
    expect(radio("C").getAttribute("aria-checked")).toBe("true");
    expect(radio("C").tabIndex).toBe(0);
    expect(radio("A").tabIndex).toBe(-1);
  });
});
