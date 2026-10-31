// Requires a reachable replica set (Atlas or Atlas Local); uses the demo database
// and removes everything it writes.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connectDB, withTransaction } from "../src/db.js";
import { Event, Interface, Relationship, SourceRecord } from "../src/models.js";

const key = `tx-test-${Date.now()}`;
// tx_test_marker is not a schema path, so strictQuery would drop it from a Mongoose filter.
const interfaces = () => mongoose.connection.db.collection("interfaces");
const counts = async () => ({
  events: await Event.countDocuments({ source_record_id: `${key}-event` }),
  relationships: await Relationship.countDocuments({ key: `${key}-rel` }),
  sourceRecords: await SourceRecord.countDocuments({ key: `${key}-src` }),
  marked: await Interface.countDocuments({ key: "if-hospital-850", version: key }),
});

// One write through each operation type the transactional flows use.
async function writeEverything() {
  await Event.create({ interface_key: "if-hospital-850", status: "failed", source_record_id: `${key}-event` });
  await Relationship.bulkWrite([{ insertOne: { document: { key: `${key}-rel`, from_type: "interface", from_key: key, to_type: "interface", to_key: key, relationship_type: "depends_on" } } }]);
  await SourceRecord.insertMany([{ key: `${key}-src`, source_system: "transaction-test", record_type: "alert" }]);
  await Interface.updateMany({ key: "if-hospital-850" }, { $set: { version: key } });
}

let originalVersion;
async function cleanup() {
  await Event.deleteMany({ source_record_id: `${key}-event` });
  await Relationship.deleteMany({ key: `${key}-rel` });
  await SourceRecord.deleteMany({ key: `${key}-src` });
  await interfaces().updateOne({ key: "if-hospital-850", version: key }, originalVersion === undefined ? { $unset: { version: "" } } : { $set: { version: originalVersion } });
}

describe("withTransaction", () => {
  before(async () => {
    await connectDB();
    originalVersion = (await interfaces().findOne({ key: "if-hospital-850" })).version;
  });
  after(async () => {
    await cleanup();
    await mongoose.disconnect();
  });

  it("[mongodb-transactions:REQ-001,REQ-005] rolls back every write when the flow fails", async () => {
    await assert.rejects(
      withTransaction(async () => {
        await writeEverything();
        const seenInside = await counts();
        assert.deepEqual(seenInside, { events: 1, relationships: 1, sourceRecords: 1, marked: 1 }, "writes visible inside the transaction");
        throw new Error("simulated failure after all writes");
      }),
      /simulated failure/
    );
    assert.deepEqual(await counts(), { events: 0, relationships: 0, sourceRecords: 0, marked: 0 });
  });

  it("[mongodb-transactions:REQ-001] commits every write when the flow succeeds", async () => {
    await withTransaction(writeEverything);
    assert.deepEqual(await counts(), { events: 1, relationships: 1, sourceRecords: 1, marked: 1 });
    await cleanup();
  });
});
