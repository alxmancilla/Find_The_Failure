import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "./App.jsx";
import { buildHash, parseHash } from "./routes.js";

// Screens are stubbed: these tests cover routing in App.jsx, not screen content.
vi.mock("./components/InvestigationWorkbench.jsx", () => ({
  default: ({ focus }) => <div data-testid="view">workbench{focus ? ` ${focus.interfaceKey} from ${focus.context}` : ""}</div>,
}));
vi.mock("./components/Explorer.jsx", () => ({
  default: ({ target, onInvestigate }) => (
    <div data-testid="view">
      explorer {target ? `${target.flow}/${target.entity}/${target.transaction || ""}` : "none"}
      <button onClick={() => onInvestigate("if-gateway-x12", "PO-1")}>investigate</button>
    </div>
  ),
}));
vi.mock("./components/Modernization.jsx", () => ({
  default: ({ systemKey, onOpenLineage }) => (
    <div data-testid="view">
      modernization {systemKey}
      <button onClick={() => onOpenLineage({ flow: "order-to-cash", entity: "sales-order" })}>open lineage</button>
    </div>
  ),
}));
vi.mock("./components/RecallTrace.jsx", () => ({ default: ({ recallKey }) => <div data-testid="view">recall {recallKey}</div> }));
vi.mock("./components/Ingestion.jsx", () => ({ default: () => <div data-testid="view">ingestion</div> }));
vi.mock("./components/DemoConsole.jsx", () => ({ default: () => <div data-testid="view">presenter</div> }));

const view = () => screen.getByTestId("view").textContent;
const goToHash = (hash) => act(() => {
  window.location.hash = hash;
  window.dispatchEvent(new HashChangeEvent("hashchange"));
});

beforeEach(() => { window.location.hash = ""; });
afterEach(cleanup);

describe("routes", () => {
  it("[navigation-routing:REQ-001,REQ-002] round-trips view and params, defaulting unknown paths to the Workbench", () => {
    expect(buildHash("explorer", { flow: "procure-to-pay", entity: "goods-receipt", transaction: "" })).toBe("#/lineage?flow=procure-to-pay&entity=goods-receipt");
    expect(parseHash("#/lineage?flow=procure-to-pay")).toEqual({ view: "explorer", params: { flow: "procure-to-pay" } });
    expect(parseHash("#/nope?x=1")).toEqual({ view: "workbench", params: {} });
    expect(parseHash("")).toEqual({ view: "workbench", params: {} });
  });
});

describe("App navigation", () => {
  it("[navigation-routing:REQ-001] selecting a screen updates the URL", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Recall Trace" }));
    expect(window.location.hash).toBe("#/recall");
    expect(view()).toContain("recall");
    fireEvent.click(screen.getByRole("button", { name: "Context Ingestion" }));
    expect(window.location.hash).toBe("#/ingestion");
  });

  it("[navigation-routing:REQ-002,REQ-005] opening a URL shows that screen and selection", () => {
    window.location.hash = "#/modernization?system=apex-erp";
    render(<App />);
    expect(view()).toBe("modernization apex-erpopen lineage");
    cleanup();
    window.location.hash = "#/recall?notice=RCL-2026-014";
    render(<App />);
    expect(view()).toBe("recall RCL-2026-014");
  });

  it("[navigation-routing:REQ-002] an unknown or empty hash shows the Workbench", () => {
    window.location.hash = "#/classic";
    render(<App />);
    expect(view()).toBe("workbench");
  });

  it("[navigation-routing:REQ-003] a hash change (Back/Forward) switches the screen", () => {
    render(<App />);
    goToHash("#/ingestion");
    expect(view()).toBe("ingestion");
    goToHash("#/lineage?flow=order-to-cash&entity=purchase-order");
    expect(view()).toContain("explorer order-to-cash/purchase-order/");
  });

  it("[navigation-routing:REQ-004] cross-screen links carry their selection in the URL", () => {
    window.location.hash = "#/modernization?system=apex-erp";
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "open lineage" }));
    expect(window.location.hash).toBe("#/lineage?flow=order-to-cash&entity=sales-order");
    expect(view()).toContain("explorer order-to-cash/sales-order/");
    fireEvent.click(screen.getByRole("button", { name: "investigate" }));
    expect(window.location.hash).toBe("#/workbench?interface=if-gateway-x12&from=PO-1");
    expect(view()).toBe("workbench if-gateway-x12 from PO-1");
  });

  it("[navigation-routing:REQ-006] More… lists only Presenter Console", () => {
    render(<App />);
    const options = [...screen.getByRole("combobox", { name: "More views" }).options].map((o) => o.textContent);
    expect(options).toEqual(["More…", "Presenter Console"]);
    expect(screen.queryByText("Classic Investigation")).toBeNull();
  });
});
