import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
  it("starts on Triage with the Case step locked until a case is open", async () => {
    render(<InvestigationWorkbench />);
    await screen.findByRole("heading", { level: 2, name: "Gateway lag" });
    expect(screen.getByRole("tab", { name: /1\. Triage/ }).getAttribute("aria-selected")).toBe("true");
    expect(caseTab().disabled).toBe(true);
    expect(caseTab().title).toBe("Open a case first");
    expect(screen.getByRole("heading", { name: "Investigation summary" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Decision and closure" })).toBeNull();
  });

  it("selects the alert on the interface a lineage trace stopped at", async () => {
    render(<InvestigationWorkbench focus={{ interfaceKey: "if-integration-erp", context: "PO-4500012388", nonce: 1 }} />);
    expect(await screen.findByRole("heading", { level: 2, name: "ERP timeout" })).toBeTruthy();
    expect(screen.getByText(/Opened from the lineage trace of PO-4500012388/)).toBeTruthy();
    expect(caseTab().disabled).toBe(true);
  });

  it("explains when no inbox alert matches the traced interface", async () => {
    render(<InvestigationWorkbench focus={{ interfaceKey: "if-supplier-810", context: "SPO-7700468", nonce: 2 }} />);
    expect(await screen.findByText(/No inbox alert on if-supplier-810 yet \(traced from SPO-7700468\)/)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Gateway lag" })).toBeTruthy();
  });
});
