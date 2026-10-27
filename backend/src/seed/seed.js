import mongoose from "mongoose";
import { connectDB } from "../db.js";
import { ensureDatabaseSetup } from "../dbSetup.js";
import {
  Owner,
  System,
  DataEntity,
  BusinessProcess,
  Interface,
  Event,
  Relationship,
  SourceRecord,
  InvestigationCase,
  OperationalKnowledge,
  LineageFlow,
  MessageEvent,
} from "../models.js";
import { normalizeLineageRecords, normalizeRelationshipSourceRecords } from "../services/ingestion.js";
import { owners, systems, dataEntities } from "./base.js";
import { businessProcesses } from "./processes.js";
import { interfaces } from "./interfaces.js";
import { events } from "./events.js";
import { INVENTORY_FIXTURE_GROUP, inventorySourceRecords } from "./relationships.js";
import { sourceRecords } from "./sourceRecords.js";
import { operationalKnowledge } from "./operationalKnowledge.js";
import { lineageSourceRecords } from "./lineageCatalog.js";
import { lineageFlows } from "./lineageFlows.js";
import { messageEvents } from "./messageEvents.js";
import { p2pLineageSourceRecords, recallLineageSourceRecords } from "./p2pLineageCatalog.js";
import { recallNotices } from "./recallNotices.js";

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
    InvestigationCase.deleteMany({}),
    OperationalKnowledge.deleteMany({}),
    LineageFlow.deleteMany({}),
    MessageEvent.deleteMany({}),
  ]);

  await Owner.insertMany(owners);
  await System.insertMany(systems);
  await DataEntity.insertMany(dataEntities);
  await BusinessProcess.insertMany(businessProcesses);
  await Interface.insertMany(interfaces);
  await Event.insertMany(events);
  await SourceRecord.insertMany(sourceRecords);
  await OperationalKnowledge.insertMany(operationalKnowledge);
  await SourceRecord.insertMany([
    ...inventorySourceRecords,
    ...lineageSourceRecords,
    ...p2pLineageSourceRecords,
    ...recallLineageSourceRecords,
    ...recallNotices,
  ]);
  await LineageFlow.insertMany(lineageFlows);
  await MessageEvent.insertMany(messageEvents);
  const inventory = await normalizeRelationshipSourceRecords({ fixture_group: INVENTORY_FIXTURE_GROUP });
  const lineage = await normalizeLineageRecords();

  console.log(
    `[seed] inserted: ${owners.length} owners, ${systems.length} systems, ` +
      `${dataEntities.length} data entities, ${businessProcesses.length} processes, ` +
      `${interfaces.length} interfaces, ${events.length} events, ` +
      `${sourceRecords.length} source records, ${operationalKnowledge.length} knowledge documents, ` +
      `${lineageFlows.length} lineage flows, ${recallNotices.length} recall notice, ${messageEvents.length} message events; ` +
      `normalized ${inventory.source_records} inventory exports into ${inventory.relationship_upserts} relationships and ` +
      `${lineage.source_records} lineage records into ${lineage.relationship_upserts} lineage relationships`
  );
  await ensureDatabaseSetup();

  await mongoose.disconnect();
  console.log("[seed] done");
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
