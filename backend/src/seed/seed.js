import mongoose from "mongoose";
import { connectDB } from "../db.js";
import {
  Owner,
  System,
  DataEntity,
  BusinessProcess,
  Interface,
  Event,
  Relationship,
  SourceRecord,
} from "../models.js";
import { owners, systems, dataEntities } from "./base.js";
import { businessProcesses } from "./processes.js";
import { interfaces } from "./interfaces.js";
import { events } from "./events.js";
import { relationships } from "./relationships.js";
import { sourceRecords } from "./sourceRecords.js";

async function seed() {
  await connectDB();

  await Promise.all([
    Owner.deleteMany({}),
    System.deleteMany({}),
    DataEntity.deleteMany({}),
    BusinessProcess.deleteMany({}),
    Interface.deleteMany({}),
    Event.deleteMany({}),
    Relationship.deleteMany({}),
    SourceRecord.deleteMany({}),
  ]);

  await Owner.insertMany(owners);
  await System.insertMany(systems);
  await DataEntity.insertMany(dataEntities);
  await BusinessProcess.insertMany(businessProcesses);
  await Interface.insertMany(interfaces);
  await Event.insertMany(events);
  await Relationship.insertMany(relationships);
  await SourceRecord.insertMany(sourceRecords);

  console.log(
    `[seed] inserted: ${owners.length} owners, ${systems.length} systems, ` +
      `${dataEntities.length} data entities, ${businessProcesses.length} processes, ` +
      `${interfaces.length} interfaces, ${events.length} events, ` +
      `${relationships.length} relationships, ${sourceRecords.length} source records`
  );

  await mongoose.disconnect();
  console.log("[seed] done");
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
