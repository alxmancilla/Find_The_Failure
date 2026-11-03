import { AUTO_EMBED_READY_TIMEOUT_MS, ENABLE_ATLAS_AUTO_EMBED_INDEX, SEARCH_INDEX_TIMEOUT_MS } from "../config.js";
import { Interface, System, Owner, BusinessProcess, DataEntity, OperationalKnowledge } from "../models.js";

const INDEX_NAME = "default";
const DEFINITION = { mappings: { dynamic: true } };
const KNOWLEDGE_VECTOR_INDEX = "operational_knowledge_auto_embed";
const AUTO_EMBED_MODEL = "voyage-4";
const MODELS = [Interface, System, Owner, BusinessProcess, DataEntity, OperationalKnowledge];
const RETRY_INTERVAL_MS = 2000;
const RETRY_LOG_INTERVAL_MS = 10000;
const ALREADY_EXISTS = /already exists|Duplicate/i;
// Atlas Local answers on 27017 before its search engine (mongot) is reachable.
const TRANSIENT = /Error connecting to Search Index Management service|search index management.*(unavailable|not ready)/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Create a dynamic Atlas Search index on each searchable collection. Idempotent:
// ignores "already exists" errors so it is safe to call on every startup.
export async function ensureSearchIndexes() {
  const deadline = Date.now() + SEARCH_INDEX_TIMEOUT_MS;
  for (const Model of MODELS) {
    const name = Model.collection.collectionName;
    const result = await createWithRetry(() => Model.collection.createSearchIndex({ name: INDEX_NAME, definition: DEFINITION }), { deadline, label: name });
    if (result === "created") console.log(`[search] created index on ${name}`);
  }
  if (ENABLE_ATLAS_AUTO_EMBED_INDEX) await ensureOperationalKnowledgeVectorIndex(deadline);
  await waitUntilQueryable(Math.max(30000, deadline - Date.now()));
  if (ENABLE_ATLAS_AUTO_EMBED_INDEX) await waitForAutoEmbedding(probeAutoEmbedding);
}

// Returns "created", "exists", "failed", or "timeout".
export async function createWithRetry(create, { deadline, label, intervalMs = RETRY_INTERVAL_MS, logIntervalMs = RETRY_LOG_INTERVAL_MS }) {
  let lastLog = 0;
  for (;;) {
    try {
      await create();
      return "created";
    } catch (err) {
      if (ALREADY_EXISTS.test(err.message)) return "exists";
      if (!TRANSIENT.test(err.message)) {
        console.warn(`[search] index on ${label}: ${err.message}`);
        return "failed";
      }
      if (Date.now() + intervalMs > deadline) {
        console.warn(`[search] index on ${label}: search service still not reachable, giving up (regex fallback active)`);
        return "timeout";
      }
      if (Date.now() - lastLog >= logIntervalMs) {
        console.log(`[search] search service not ready, retrying (${label})`);
        lastLog = Date.now();
      }
      await sleep(intervalMs);
    }
  }
}

// READY on the vector index does not mean every document is embedded yet.
export async function waitForAutoEmbedding(probe, { timeoutMs = AUTO_EMBED_READY_TIMEOUT_MS, intervalMs = 5000 } = {}) {
  const start = Date.now();
  console.log(`[search] waiting for auto-embedding to return results (up to ${Math.round(timeoutMs / 1000)} s)`);
  for (;;) {
    let count = 0;
    try {
      count = await probe();
    } catch {
      count = 0;
    }
    const seconds = Math.round((Date.now() - start) / 1000);
    if (count > 0) {
      console.log(`[search] auto-embedding ready: probe returned ${count} documents after ${seconds} s`);
      return true;
    }
    if (Date.now() - start + intervalMs > timeoutMs) {
      console.warn(`[search] auto-embedding not ready after ${seconds} s; related context uses Atlas Search until embeddings finish`);
      return false;
    }
    await sleep(intervalMs);
  }
}

async function probeAutoEmbedding() {
  const docs = await OperationalKnowledge.aggregate([
    { $vectorSearch: { index: KNOWLEDGE_VECTOR_INDEX, path: "text", query: { text: "integration failure" }, model: AUTO_EMBED_MODEL, numCandidates: 10, limit: 10 } },
    { $project: { _id: 1 } },
  ]);
  return docs.length;
}

async function ensureOperationalKnowledgeVectorIndex(deadline) {
  const result = await createWithRetry(() => OperationalKnowledge.collection.createSearchIndex({
    name: KNOWLEDGE_VECTOR_INDEX,
    type: "vectorSearch",
    definition: {
      fields: [
        { type: "autoEmbed", modality: "text", path: "text", model: AUTO_EMBED_MODEL },
        { type: "filter", path: "interface_key" },
        { type: "filter", path: "business_process_key" },
        { type: "filter", path: "type" },
      ],
    },
  }), { deadline, label: `${OperationalKnowledge.collection.collectionName} (auto-embedding)` });
  if (result === "created") console.log(`[search] created auto-embedding vector index on ${OperationalKnowledge.collection.collectionName}`);
}

// Poll listSearchIndexes until each index reports queryable (or timeout).
async function waitUntilQueryable(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const states = await Promise.all(
      MODELS.map(async (Model) => {
        try {
          const idx = await Model.collection.listSearchIndexes(INDEX_NAME).toArray();
          return idx[0]?.queryable === true;
        } catch {
          return false;
        }
      })
    );
    if (states.every(Boolean)) {
      console.log("[search] all search indexes are queryable");
      return true;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.warn("[search] timed out waiting for search indexes (regex fallback active)");
  return false;
}

export { AUTO_EMBED_MODEL, INDEX_NAME, KNOWLEDGE_VECTOR_INDEX };
