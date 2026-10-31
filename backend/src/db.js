import mongoose from "mongoose";
import { MONGO_APP_NAME, MONGO_MAX_POOL_SIZE, MONGO_SERVER_SELECTION_TIMEOUT_MS, MONGO_URI } from "./config.js";

// Inside withTransaction(), Mongoose passes the session to every operation
// automatically, so services do not thread `{ session }` through each call.
mongoose.set("transactionAsyncLocalStorage", true);

const TRANSACTION_OPTIONS = { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } };

// Run fn's writes as one all-or-nothing transaction; transient errors are retried.
// Operations inside must run sequentially (no Promise.all) and must not use Atlas Search.
export function withTransaction(fn) {
  return mongoose.connection.transaction(fn, TRANSACTION_OPTIONS);
}

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
