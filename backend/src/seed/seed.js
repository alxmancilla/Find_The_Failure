import mongoose from "mongoose";
import { connectDB } from "../db.js";
import { Owner, System, DataEntity, Interface, Event } from "../models.js";
import { owners, systems, dataEntities } from "./base.js";
import { interfaces } from "./interfaces.js";
import { events } from "./events.js";

async function seed() {
  await connectDB();

  await Promise.all([
    Owner.deleteMany({}),
    System.deleteMany({}),
    DataEntity.deleteMany({}),
    Interface.deleteMany({}),
    Event.deleteMany({}),
  ]);

  await Owner.insertMany(owners);
  await System.insertMany(systems);
  await DataEntity.insertMany(dataEntities);
  await Interface.insertMany(interfaces);
  await Event.insertMany(events);

  console.log(
    `[seed] inserted: ${owners.length} owners, ${systems.length} systems, ` +
      `${dataEntities.length} data entities, ${interfaces.length} interfaces, ` +
      `${events.length} events`
  );

  await mongoose.disconnect();
  console.log("[seed] done");
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
