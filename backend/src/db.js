import mongoose from "mongoose";
import { MONGO_APP_NAME, MONGO_MAX_POOL_SIZE, MONGO_SERVER_SELECTION_TIMEOUT_MS, MONGO_URI } from "./config.js";

export async function connectDB() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(MONGO_URI, {
    appName: MONGO_APP_NAME,
    maxPoolSize: MONGO_MAX_POOL_SIZE,
    serverSelectionTimeoutMS: MONGO_SERVER_SELECTION_TIMEOUT_MS,
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
