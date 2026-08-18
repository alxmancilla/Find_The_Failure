import express from "express";
import cors from "cors";
import { PORT } from "./config.js";
import { connectDB } from "./db.js";
import router from "./routes.js";
import { ensureSearchIndexes } from "./services/searchIndex.js";

async function main() {
  await connectDB();
  await ensureSearchIndexes().catch((e) =>
    console.warn(`[search] index setup skipped: ${e.message}`)
  );

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", router);

  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
