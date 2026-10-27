import mongoose from "mongoose";
import "./models.js";

// Database-enforced document shape. `moderate` + `warn` keeps the flexible model
// writable (existing invalid documents and unknown fields are allowed) while
// MongoDB logs any write that does not match.
const NUMBER = ["double", "int", "long", "decimal"];
const STRING = { bsonType: "string" };
const STRING_ARRAY = { bsonType: "array", items: STRING };
const SCOPE_FIELDS = { tenant_id: STRING, environment: STRING };

export const VALIDATORS = {
  relationships: {
    bsonType: "object",
    required: ["key", "tenant_id", "environment", "from_type", "from_key", "to_type", "to_key", "relationship_type"],
    properties: {
      key: STRING,
      ...SCOPE_FIELDS,
      from_type: { enum: ["interface", "system", "data_entity"] },
      to_type: { enum: ["interface", "system", "data_entity", "business_process"] },
      from_key: STRING,
      to_key: STRING,
      relationship_type: {
        enum: ["depends_on", "supports_process", "routes_through", "produces", "carries", "transforms_to", "consumes", "system_of_record"],
      },
      confidence: { bsonType: NUMBER, minimum: 0, maximum: 1 },
      confirmed: { bsonType: "bool" },
      field_mappings: { bsonType: "array" },
      mapping_versions: { bsonType: "array" },
      review: { bsonType: "object", properties: { status: { enum: ["confirmed", "rejected"] } } },
      review_history: { bsonType: "array" },
    },
  },
  message_events: {
    bsonType: "object",
    required: ["key", "tenant_id", "environment", "flow", "interface_key", "business_keys", "status", "observed_at"],
    properties: {
      key: STRING,
      ...SCOPE_FIELDS,
      flow: STRING,
      interface_key: STRING,
      business_keys: { bsonType: "object" },
      status: { enum: ["delivered", "failed", "on_hold", "pending"] },
      movement: { enum: ["receipt", "shipment"] },
      quantity: { bsonType: NUMBER, minimum: 0 },
      observed_at: { bsonType: "date" },
    },
  },
  source_records: {
    bsonType: "object",
    required: ["key", "tenant_id", "environment", "source_system", "record_type"],
    properties: {
      key: STRING,
      ...SCOPE_FIELDS,
      source_system: STRING,
      record_type: { enum: ["alert", "change", "lineage", "recall", "relationship"] },
      payload: { bsonType: "object" },
      observed_at: { bsonType: "date" },
    },
  },
  lineage_flows: {
    bsonType: "object",
    required: ["key", "tenant_id", "environment", "name", "domain", "identifier", "entity_order", "path"],
    properties: {
      key: STRING,
      ...SCOPE_FIELDS,
      name: STRING,
      domain: STRING,
      identifier: STRING,
      entity_order: { ...STRING_ARRAY, minItems: 1 },
      path: { ...STRING_ARRAY, minItems: 1 },
    },
  },
};

async function applyValidators(db) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  const report = [];
  for (const [name, schema] of Object.entries(VALIDATORS)) {
    const options = { validator: { $jsonSchema: schema }, validationLevel: "moderate", validationAction: "warn" };
    if (existing.has(name)) await db.command({ collMod: name, ...options });
    else await db.createCollection(name, options);
    const nonMatching = await db.collection(name).countDocuments({ $nor: [{ $jsonSchema: schema }] });
    report.push({ collection: name, non_matching: nonMatching });
  }
  return report;
}

// Drop indexes that are no longer declared in a schema (Mongoose only creates).
// Atlas Search / Vector Search indexes are managed separately and are not affected.
async function syncAllIndexes() {
  const dropped = [];
  for (const model of Object.values(mongoose.models)) {
    const names = await model.syncIndexes();
    names.forEach((index) => dropped.push(`${model.collection.collectionName}.${index}`));
  }
  return dropped;
}

export async function ensureDatabaseSetup() {
  const db = mongoose.connection.db;
  const validators = await applyValidators(db);
  const dropped = await syncAllIndexes();
  console.log(`[db] validators (warn): ${validators.map((v) => `${v.collection} ${v.non_matching} non-matching`).join(", ")}`);
  console.log(`[db] indexes synced${dropped.length ? `; dropped ${dropped.join(", ")}` : ""}`);
  return { validators, dropped };
}
