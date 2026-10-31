// Validators, indexes, query plans, and connection settings against the demo database.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connectDB } from "../src/db.js";
import { MONGO_APP_NAME, MONGO_MAX_POOL_SIZE, MONGO_SERVER_SELECTION_TIMEOUT_MS } from "../src/config.js";
import { ensureDatabaseSetup, VALIDATORS } from "../src/dbSetup.js";
import { businessKeyMatch, Event, InvestigationCase, MessageEvent, Relationship, SourceRecord } from "../src/models.js";

const S = { tenant_id: "apex-health-supply", environment: "production" };
let db;

const indexNames = async (collection) => (await db.collection(collection).indexes()).map((i) => i.name);
const planIndexes = async (query) => {
  const plan = JSON.stringify((await query.explain("queryPlanner")).queryPlanner.winningPlan);
  return [...new Set([...plan.matchAll(/"indexName":"([^"]+)"/g)].map((m) => m[1]))];
};
const passes = async (collection, docs) =>
  (await db.aggregate([{ $documents: docs }, { $match: { $jsonSchema: VALIDATORS[collection] } }]).toArray()).map((d) => d.key);

const ATTRIBUTE_INDEX = "tenant_id_1_environment_1_business_key_attributes.k_1_business_key_attributes.v_1_observed_at_1";

describe("database setup", () => {
  before(async () => {
    await connectDB();
    db = mongoose.connection.db;
  });
  after(() => mongoose.disconnect());

  it("[mongodb-hygiene:REQ-001] four collections have moderate/warn $jsonSchema validators", async () => {
    const infos = await db.listCollections({ name: { $in: Object.keys(VALIDATORS) } }).toArray();
    assert.equal(infos.length, 4);
    for (const info of infos) {
      assert.ok(info.options.validator?.$jsonSchema, `${info.name} validator`);
      assert.equal(info.options.validationLevel, "moderate");
      assert.equal(info.options.validationAction, "warn");
    }
  });

  it("[mongodb-hygiene:REQ-002][business-key-attribute-pattern:REQ-004] validators accept good documents and flag bad ones", async () => {
    const edge = { key: "ok", tenant_id: "t", environment: "e", from_type: "interface", from_key: "a", to_type: "interface", to_key: "b", relationship_type: "depends_on", confidence: 0.5, confirmed: true };
    assert.deepEqual(await passes("relationships", [
      edge,
      { ...edge, key: "bad-confidence", confidence: 1.5 },
      { ...edge, key: "bad-type", relationship_type: "likes" },
      { ...edge, key: "bad-confirmed", confirmed: "yes" },
    ]), ["ok"]);
    const event = { key: "ok", tenant_id: "t", environment: "e", flow: "f", interface_key: "i", status: "delivered", observed_at: new Date(), business_keys: { po_number: "P" }, business_key_attributes: [{ k: "po_number", v: "P" }] };
    assert.deepEqual(await passes("message_events", [
      event,
      { ...event, key: "no-attributes", business_key_attributes: undefined },
      { ...event, key: "bad-pair", business_key_attributes: [{ k: 1, v: "P" }] },
      { ...event, key: "bad-status", status: "lost" },
    ]), ["ok"]);
  });

  it("[mongodb-hygiene:REQ-003,REQ-006] setup reports zero non-matching documents and drops undeclared indexes", async () => {
    await db.collection("lineage_flows").createIndex({ name: 1 }, { name: "undeclared_test_index" });
    const report = await ensureDatabaseSetup();
    assert.deepEqual(report.validators.map((v) => v.non_matching), [0, 0, 0, 0]);
    assert.ok(report.dropped.includes("lineage_flows.undeclared_test_index"));
    assert.ok(!(await indexNames("lineage_flows")).includes("undeclared_test_index"));
  });

  it("[mongodb-hygiene:REQ-004][business-key-attribute-pattern:REQ-002] removed indexes are gone and one business-key index remains", async () => {
    const removed = {
      relationships: ["from_type_1_from_key_1_relationship_type_1", "to_type_1_to_key_1_relationship_type_1"],
      interfaces: ["name_text_description_text_type_text_protocol_text_source_text_target_text"],
      operational_knowledge: ["interface_key_1_type_1", "business_process_key_1_type_1"],
      investigation_cases: ["alert_key_1_createdAt_-1", "status_1_updatedAt_-1"],
      source_records: ["source_system_1_record_type_1", "entity_type_1_entity_key_1"],
    };
    for (const [collection, names] of Object.entries(removed)) {
      const present = await indexNames(collection);
      names.forEach((name) => assert.ok(!present.includes(name), `${collection}.${name} should be dropped`));
    }
    const eventIndexes = (await indexNames("message_events")).filter((n) => n.includes("business_key"));
    assert.deepEqual(eventIndexes, [ATTRIBUTE_INDEX]);
  });

  it("[business-key-attribute-pattern:REQ-001] every message event carries attributes matching its business keys", async () => {
    const events = await MessageEvent.find(S).lean();
    assert.ok(events.length > 0);
    for (const e of events) {
      assert.deepEqual(e.business_key_attributes, Object.entries(e.business_keys).map(([k, v]) => ({ k, v })), e.key);
    }
  });

  it("[business-key-attribute-pattern:REQ-003] every business-key query shape uses the attribute index", async () => {
    const shapes = [
      MessageEvent.find({ ...S, flow: "order-to-cash", ...businessKeyMatch("po_number") }),
      MessageEvent.find({ ...S, flow: "order-to-cash", ...businessKeyMatch("po_number", "PO-4500012388") }),
      MessageEvent.find({ ...S, ...businessKeyMatch("lot_number", "L-2291") }),
      MessageEvent.find({ ...S, movement: "shipment", ...businessKeyMatch("lot_number", "L-2291") }),
      MessageEvent.find({ ...S, movement: "receipt", ...businessKeyMatch("udi_device_identifier", "x"), "business_key_attributes.k": { $ne: "lot_number" } }),
    ];
    for (const query of shapes) assert.deepEqual(await planIndexes(query.sort({ observed_at: 1 })), [ATTRIBUTE_INDEX]);
    const pairs = await MessageEvent.countDocuments({ ...S, ...businessKeyMatch("po_number", "PO-4500012388") });
    assert.ok(pairs > 0, "elemMatch finds the order");
  });

  it("[mongodb-hygiene:REQ-005][mongodb-agent-hardening:REQ-002][lineage-integration:REQ-008] hot-path queries use tenant-scoped or edge-key indexes", async () => {
    const expected = [
      [SourceRecord.find({ ...S, record_type: "alert" }).sort({ observed_at: -1 }), "tenant_id_1_environment_1_record_type_1_observed_at_-1"],
      [SourceRecord.find({ ...S, record_type: "alert", "payload.alert_group_key": "g" }).sort({ observed_at: -1 }), "tenant_id_1_environment_1_record_type_1_payload.alert_group_key_1_observed_at_-1"],
      [InvestigationCase.find(S).sort({ updatedAt: -1 }).limit(12), "tenant_id_1_environment_1_updatedAt_-1"],
      [Event.find({ ...S, interface_key: "if-integration-erp" }).sort({ timestamp: -1 }).limit(5), "tenant_id_1_environment_1_interface_key_1_timestamp_-1"],
      [Relationship.find({ relationship_type: "carries", from_key: { $in: ["if-erp-856"] }, ...S }), "from_key_1_relationship_type_1_tenant_id_1_environment_1"],
      [Relationship.find({ relationship_type: "system_of_record", to_key: "apex-erp", ...S }), "to_key_1_relationship_type_1_tenant_id_1_environment_1"],
    ];
    for (const [query, index] of expected) assert.deepEqual(await planIndexes(query), [index]);
  });

  it("[mongodb-hygiene:REQ-007] the client uses the configured appName, pool size, and selection timeout", () => {
    const options = mongoose.connection.getClient().options;
    assert.equal(options.appName, MONGO_APP_NAME);
    assert.equal(options.maxPoolSize, MONGO_MAX_POOL_SIZE);
    assert.equal(options.serverSelectionTimeoutMS, MONGO_SERVER_SELECTION_TIMEOUT_MS);
  });
});
