import { ENABLE_ATLAS_AUTO_EMBED_INDEX } from "../config.js";
import { Interface, System, Owner, BusinessProcess, OperationalKnowledge } from "../models.js";

const INDEX_NAME = "default";
const DEFINITION = { mappings: { dynamic: true } };
const KNOWLEDGE_VECTOR_INDEX = "operational_knowledge_auto_embed";
const AUTO_EMBED_MODEL = "voyage-4";
const MODELS = [Interface, System, Owner, BusinessProcess, OperationalKnowledge];

// Create a dynamic Atlas Search index on each searchable collection. Idempotent:
// ignores "already exists" errors so it is safe to call on every startup.
export async function ensureSearchIndexes() {
  for (const Model of MODELS) {
    try {
      await Model.collection.createSearchIndex({
        name: INDEX_NAME,
        definition: DEFINITION,
      });
      console.log(`[search] created index on ${Model.collection.collectionName}`);
    } catch (err) {
      if (/already exists|Duplicate/i.test(err.message)) continue;
      console.warn(`[search] index on ${Model.collection.collectionName}: ${err.message}`);
    }
  }
  if (ENABLE_ATLAS_AUTO_EMBED_INDEX) await ensureOperationalKnowledgeVectorIndex();
  await waitUntilQueryable();
}

async function ensureOperationalKnowledgeVectorIndex() {
  try {
    await OperationalKnowledge.collection.createSearchIndex({
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
    });
    console.log(`[search] created auto-embedding vector index on ${OperationalKnowledge.collection.collectionName}`);
  } catch (err) {
    if (/already exists|Duplicate/i.test(err.message)) return;
    console.warn(`[search] auto-embedding index skipped: ${err.message}`);
  }
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
