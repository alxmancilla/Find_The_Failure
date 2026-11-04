import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import InvestigationWorkbench from "./InvestigationWorkbench.jsx";
import { api } from "../api.js";

vi.mock("../api.js", () => ({ api: {} }));
vi.mock("./DependencyGraph.jsx", () => ({ default: () => <div>graph</div> }));

const alert = (key, interfaceKey, reason) => ({
  key, interface_key: interfaceKey, reason, severity: "critical", status: "failed", source_system: "alertmanager-webhook", external_id: key,
});

beforeEach(() => {
  Object.assign(api, {
    alerts: vi.fn().mockResolvedValue({ alerts: [alert("a1", "if-gateway-x12", "Gateway lag"), alert("a2", "if-integration-erp", "ERP timeout")] }),
    cases: vi.fn().mockResolvedValue({ cases: [] }),
    flow: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
  });
});
afterEach(cleanup);

const caseTab = () => screen.getByRole("tab", { name: /2\. Case/ });

describe("InvestigationWorkbench", () => {
  it("[ux-clarity:REQ-012] starts on Triage with the Case step locked until a case is open", async () => {
    render(<InvestigationWorkbench />);
    await screen.findByRole("heading", { level: 2, name: "Gateway lag" });
    expect(screen.getByRole("tab", { name: /1\. Triage/ }).getAttribute("aria-selected")).toBe("true");
    expect(caseTab().disabled).toBe(true);
    expect(caseTab().title).toBe("Open a case first");
    expect(screen.getByRole("heading", { name: "Investigation summary" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Decision and closure" })).toBeNull();
  });

  it("[ux-clarity:REQ-010] selects the alert on the interface a lineage trace stopped at", async () => {
    render(<InvestigationWorkbench focus={{ interfaceKey: "if-integration-erp", context: "PO-4500012388", nonce: 1 }} />);
    expect(await screen.findByRole("heading", { level: 2, name: "ERP timeout" })).toBeTruthy();
    expect(screen.getByText(/Opened from the lineage trace of PO-4500012388/)).toBeTruthy();
    expect(caseTab().disabled).toBe(true);
  });

  it("[ux-clarity:REQ-010] explains when no inbox alert matches the traced interface", async () => {
    render(<InvestigationWorkbench focus={{ interfaceKey: "if-supplier-810", context: "SPO-7700468", nonce: 2 }} />);
    expect(await screen.findByText(/No inbox alert on if-supplier-810 yet \(traced from SPO-7700468\)/)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Gateway lag" })).toBeTruthy();
  });

  it("[workbench-answer-first:REQ-001,REQ-002,REQ-005] puts the answer card first in the main column and not in the rail", async () => {
    const { container } = render(<InvestigationWorkbench />);
    await screen.findByRole("heading", { level: 2, name: "Gateway lag" });
    const summaries = screen.getAllByRole("heading", { name: "Investigation summary" });
    expect(summaries).toHaveLength(1);
    const card = summaries[0].closest("section");
    expect(card.parentElement.classList.contains("workbench-main")).toBe(true);
    const graph = container.querySelector(".workbench-graph");
    expect(card.compareDocumentPosition(graph) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(card.compareDocumentPosition(container.querySelector(".case-stats")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(card).getByRole("button", { name: "Open investigation case" })).toBeTruthy();
    expect(container.querySelector(".workbench-right .investigation-summary-card")).toBeNull();
  });

  it("[workbench-answer-first:REQ-003] shows exactly one primary Open investigation case button", async () => {
    render(<InvestigationWorkbench />);
    await screen.findByRole("heading", { level: 2, name: "Gateway lag" });
    const buttons = screen.getAllByRole("button", { name: "Open investigation case" });
    expect(buttons.filter((b) => b.classList.contains("primary"))).toHaveLength(1);
  });

  it("[workbench-answer-first:REQ-004] keeps the recommended flow in a collapsed Presenter guide", async () => {
    const { container } = render(<InvestigationWorkbench />);
    await screen.findByRole("heading", { level: 2, name: "Gateway lag" });
    const guide = container.querySelector("details.presenter-guide");
    expect(guide.open).toBe(false);
    expect(within(guide).getByText("Presenter guide")).toBeTruthy();
    expect(guide.querySelector(".demo-hint")).toBeTruthy();
    expect(container.querySelectorAll(".next-best-panel")).toHaveLength(1);
  });

  it("[demo-outcome-targets:REQ-004] Q1: impact, owner, and next safe check in 1 click from the landing screen", async () => {
    const investigation = {
      alert: alert("a1", "if-gateway-x12", "Gateway lag"),
      investigation_summary: "Gateway lag is delaying hospital orders.",
      topology: { alert_interface: { key: "if-gateway-x12", name: "850 Gateway to X12 Translation" }, downstream_interfaces: [] },
      impacted_business_processes: [{ key: "hospital-order-fulfillment", name: "Hospital Order Fulfillment" }],
      affected_systems: [],
      owners: [{ key: "edi-ops", name: "EDI Operations" }],
      likely_fault_domains: [{ key: "x12-translator", name: "X12 Translator", type: "system", score: 0.8, reason: "Queue depth over threshold" }],
      evidence: [],
      recommended_next_actions: ["Check the X12 translation queue depth"],
      related_context: { documents: [] },
      similar_cases: { documents: [] },
      change_correlation: { documents: [] },
      alert_deduplication: { signal_count: 1, suppressed_count: 0 },
    };
    Object.assign(api, {
      createInvestigationCase: vi.fn().mockResolvedValue({ case: { key: "case-1", timeline: [] }, investigation }),
    });
    let clicks = 0;
    const click = (el) => { clicks += 1; fireEvent.click(el); };
    render(<InvestigationWorkbench />);
    await screen.findByRole("heading", { level: 2, name: "Gateway lag" });
    const summary = screen.getByRole("heading", { name: "Investigation summary" }).closest("section");
    click(within(summary).getByRole("button", { name: "Open investigation case" }));
    expect(await within(summary).findByText("Hospital Order Fulfillment", {}, { timeout: 6000 })).toBeTruthy();
    expect(within(summary).getByText("EDI Operations")).toBeTruthy();
    expect(within(summary).getByText("Check the X12 translation queue depth")).toBeTruthy();
    expect(clicks).toBeLessThanOrEqual(1);
  }, 10000);
});
