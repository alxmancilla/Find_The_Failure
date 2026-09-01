import mongoose from "mongoose";
import { MONGO_URI } from "./config.js";

export async function connectDB() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(MONGO_URI, {
    retryWrites: true,
    retryReads: true,
    writeConcern: { w: "majority" },
  });
  // Never log the URI itself — it may contain credentials. Log the host only.
  const { host, name } = mongoose.connection;
  console.log(`[db] connected: ${host}/${name}`);
  return mongoose.connection;
}

export { MONGO_URI };
