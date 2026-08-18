import mongoose from "mongoose";
import { MONGO_URI } from "./config.js";

export async function connectDB() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(MONGO_URI);
  console.log(`[db] connected: ${MONGO_URI}`);
  return mongoose.connection;
}

export { MONGO_URI };
