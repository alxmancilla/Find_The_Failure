import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import RecallTrace from "./RecallTrace.jsx";
import { api } from "../api.js";

vi.mock("../api.js", () => ({ api: {} }));

const detail = {
  recall: {
    key: "RCL-1", lot_number: "L-1", product: "IV Set", recall_class: "Class II", reason: "Seal defect",
    udi_device_identifier: "0081", issued_at: "2026-10-01", source_record_id: "src-1",
  },
  trace: {
    totals: { received: 300, shipped: 180, on_hand: 120 },
    customers: [
      { ship_to: "Hospital A", orders: ["PO-1"], shipments: ["SH-1"], quantity: 80, last_shipped_at: "2026-10-20" },
      { ship_to: "Hospital B", orders: ["PO-2"], shipments: ["SH-2"], quantity: 100, last_shipped_at: "2026-10-21" },
    ],
    flows: [{ flow: "procure-to-pay", name: "Procure to Pay", transactions: ["SPO-9"], hops: [] }],
    mongodb_trace: { purpose: "Lot lookup", code: "db.message_events.aggregate([])" },
  },
  untraceable_receipts: [{ receipt_number: "GR-1", quantity: 250, observed_at: "2025-06-10", supplier_po_number: "SPO-1" }],
  coverage: { as_of: null, flows: [], internal_steps: [] },
  recommended_actions: ["Quarantine 120 units"],
  guardrail: "Read-only recall analysis.",
};

beforeEach(() => {
  Object.assign(api, {
    recalls: vi.fn().mockResolvedValue({ recalls: [{ key: "RCL-1", product: "IV Set", lot_number: "L-1" }] }),
    recall: vi.fn().mockResolvedValue(detail),
  });
});
afterEach(cleanup);

describe("RecallTrace", () => {
  it("answers first: hospitals, on-hand units, and untraceable receipts, then the actions", async () => {
    render(<RecallTrace />);
    const answer = await screen.findByText((_, el) => el?.classList?.contains("recall-answer"));
    expect(answer.textContent).toContain("reached 2 hospitals: Hospital A, Hospital B");
    expect(answer.textContent).toContain("120 units are still on hand");
    expect(answer.textContent).toContain("1 receipt (250 units) cannot be traced by lot");
    const actions = screen.getByRole("heading", { name: "Recommended actions" });
    const notice = screen.getByRole("heading", { name: "Class II · IV Set" });
    expect(actions.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("opens linked orders in the Data view on the right flow and entity", async () => {
    const onOpenLineage = vi.fn();
    render(<RecallTrace onOpenLineage={onOpenLineage} />);
    fireEvent.click(await screen.findByRole("button", { name: "PO-1" }));
    expect(onOpenLineage).toHaveBeenLastCalledWith({ flow: "order-to-cash", entity: "advance-ship-notice", transaction: "PO-1" });
    fireEvent.click(screen.getByRole("button", { name: "SPO-1" }));
    expect(onOpenLineage).toHaveBeenLastCalledWith({ flow: "procure-to-pay", entity: "goods-receipt", transaction: "SPO-1" });
    fireEvent.click(screen.getByRole("button", { name: "SPO-9" }));
    expect(onOpenLineage).toHaveBeenLastCalledWith({ flow: "procure-to-pay", entity: "goods-receipt", transaction: "SPO-9" });
  });

  it("renders plain text instead of links when no navigation handler is given", async () => {
    render(<RecallTrace />);
    await screen.findByText(/cannot be traced by lot/);
    expect(screen.queryByRole("button", { name: "PO-1" })).toBeNull();
    expect(screen.getByText("PO-1")).toBeTruthy();
  });

  it("shows a retry notice when the trace fails and recovers on Retry", async () => {
    api.recall.mockRejectedValueOnce(new Error("Failed to fetch"));
    render(<RecallTrace />);
    expect((await screen.findByRole("alert")).textContent).toContain("Unable to load recall trace.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(/cannot be traced by lot/)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows an empty state when no recall notices exist", async () => {
    api.recalls.mockResolvedValueOnce({ recalls: [] });
    render(<RecallTrace />);
    expect(await screen.findByText("No recall notices")).toBeTruthy();
    expect(api.recall).not.toHaveBeenCalled();
  });
});
