import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { PORT } from "./config.js";
import { connectDB } from "./db.js";
import router from "./routes.js";
import { ensureSearchIndexes } from "./services/searchIndex.js";

const READY_STATES = ["disconnected", "connected", "connecting", "disconnecting"];

async function main() {
  await connectDB();
  await ensureSearchIndexes().catch((e) =>
    console.warn(`[search] index setup skipped: ${e.message}`)
  );

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    const readyState = mongoose.connection.readyState;
    const ok = readyState === 1;
    res.status(ok ? 200 : 503).json({
      ok,
      db: {
        state: READY_STATES[readyState] || "unknown",
        name: mongoose.connection.name,
        host: mongoose.connection.host,
      },
    });
  });
  app.use("/api", router);

  app.use((err, req, res, _next) => {
    const status = err.status || err.statusCode || (err.type === "entity.parse.failed" ? 400 : 500);
    const message = status >= 500 ? "internal server error" : err.message;
    // Do not log full error objects; parser/driver errors can include request bodies.
    console.error(`[api] ${req.method} ${req.originalUrl} -> ${status}: ${err.message}`);
    res.status(status).json({ error: message });
  });

  const server = app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[server] port ${PORT} is already in use`);
    } else {
      console.error("[server] listen failed:", err);
    }
    process.exit(1);
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] ${signal} received, shutting down...`);
    server.close(async (err) => {
      if (err) console.error("[server] shutdown error:", err);
      await mongoose.disconnect();
      console.log("[server] shutdown complete");
      process.exit(err ? 1 : 0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
