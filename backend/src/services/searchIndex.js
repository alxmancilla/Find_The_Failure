import { Interface, System, Owner } from "../models.js";

const INDEX_NAME = "default";
const DEFINITION = { mappings: { dynamic: true } };
const MODELS = [Interface, System, Owner];

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
  await waitUntilQueryable();
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

export { INDEX_NAME };
