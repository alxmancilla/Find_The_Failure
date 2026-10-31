// Read-only checks that the seeded model contains what the specs require.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connectDB } from "../src/db.js";
import { BusinessProcess, DataEntity, Interface, Relationship, System } from "../src/models.js";

const S = { tenant_id: "apex-health-supply", environment: "production" };
const edge = (from_key, to_key, relationship_type = "transforms_to") => Relationship.findOne({ ...S, from_key, to_key, relationship_type }).lean();
const messageTypes = async (keys) => Object.fromEntries((await Interface.find({ key: { $in: keys } }).lean()).map((i) => [i.key, i.message_type]));

describe("seeded model", () => {
  before(connectDB);
  after(() => mongoose.disconnect());

  it("[operational-lineage:REQ-002] the cash interfaces 856, 810, and 820 exist", async () => {
    assert.deepEqual(await messageTypes(["if-erp-856", "if-erp-810", "if-hospital-820"]), { "if-erp-856": "856", "if-erp-810": "810", "if-hospital-820": "820" });
  });

  it("[lineage-integration:REQ-005] carries and consumes use the entity on the wire", async () => {
    const hop = await Relationship.findOne({ ...S, relationship_type: "transforms_to", interface_key: "if-integration-erp" }).lean();
    assert.deepEqual([hop.from_key, hop.to_key, hop.transformed_by], ["canonical-order", "sales-order", "apex-erp"]);
    assert.ok(await edge("if-integration-erp", "canonical-order", "carries"), "the ERP order-create hop carries the canonical order, not the sales order");
    assert.ok(await edge("apex-erp", "canonical-order", "consumes"));
    assert.equal(await Relationship.countDocuments({ ...S, from_key: "if-integration-erp", to_key: "sales-order", relationship_type: "carries" }), 0);
  });

  it("[procure-to-pay:REQ-001] Meridian Medical Supply is a seeded system", async () => {
    assert.equal((await System.findOne({ key: "meridian-medical" }).lean())?.name, "Meridian Medical Supply");
  });

  it("[procure-to-pay:REQ-003] the supplier 855, 856, goods receipt, 810, and 820 interfaces exist", async () => {
    assert.deepEqual(await messageTypes(["if-supplier-855", "if-supplier-856", "if-receiving-erp", "if-supplier-810", "if-erp-820-supplier"]), {
      "if-supplier-855": "855",
      "if-supplier-856": "856",
      "if-receiving-erp": "goods-received",
      "if-supplier-810": "810",
      "if-erp-820-supplier": "820",
    });
  });

  it("[procure-to-pay:REQ-004] the existing supplier 850 is described in lineage without changing the interface", async () => {
    const hop = await edge("purchase-requisition", "supplier-purchase-order");
    assert.equal(hop?.interface_key, "if-inventory-supplier");
    const iface = await Interface.findOne({ key: "if-inventory-supplier" }).lean();
    assert.equal(iface.message_type, "850");
    assert.ok(!("lineage" in iface));
  });

  it("[procure-to-pay:REQ-011] Supplier Invoice and Payment maps the AP interfaces", async () => {
    const process = await BusinessProcess.findOne({ key: "supplier-invoice-payment" }).lean();
    assert.equal(process?.name, "Supplier Invoice and Payment");
    const mapped = (await Relationship.find({ ...S, relationship_type: "supports_process", to_key: process.key }).lean()).map((r) => r.from_key).sort();
    assert.deepEqual(mapped, ["if-erp-820-supplier", "if-supplier-810"]);
  });

  it("[product-recall-traceability:REQ-001,REQ-002] Recall Notice and Inventory Lot have their systems of record, identifiers, and data owner", async () => {
    const byKey = Object.fromEntries((await DataEntity.find({ key: { $in: ["recall-notice", "inventory-lot"] } }).lean()).map((e) => [e.key, e]));
    assert.equal(byKey["recall-notice"].system_of_record, "meridian-medical");
    assert.equal(byKey["inventory-lot"].system_of_record, "inventory-service");
    for (const e of Object.values(byKey)) {
      assert.ok(e.identifiers.includes("lot_number") && e.identifiers.includes("udi_device_identifier"), e.key);
      assert.equal(e.data_owner, "quality-regulatory");
    }
  });

  it("[product-recall-traceability:REQ-003] the lot chain links procure-to-pay to the customer ship notice", async () => {
    for (const [from, to] of [["supplier-ship-notice", "goods-receipt"], ["goods-receipt", "inventory-lot"], ["inventory-lot", "advance-ship-notice"]]) {
      const hop = await edge(from, to);
      assert.ok(hop?.field_mappings?.some((m) => m.field === "lot_number"), `${from} -> ${to} maps lot_number`);
    }
  });
});
