import { Interface, System, Owner } from "../models.js";
import { INDEX_NAME } from "./searchIndex.js";

// Public search: try Atlas Search ($search, fuzzy + relevance ranking); if the
// search index is unavailable, transparently fall back to a regex scan.
export async function search(q) {
  if (!q || !q.trim()) return { interfaces: [], systems: [], owners: [], engine: "none" };
  try {
    return await searchAtlas(q.trim());
  } catch (err) {
    console.warn(`[search] $search failed, using regex fallback: ${err.message}`);
    return await searchRegex(q.trim());
  }
}

// Atlas Search across all indexed string fields with typo tolerance.
async function searchAtlas(q) {
  const pipeline = () => [
    {
      $search: {
        index: INDEX_NAME,
        text: { query: q, path: { wildcard: "*" }, fuzzy: { maxEdits: 2 } },
      },
    },
    { $limit: 20 },
    { $addFields: { score: { $meta: "searchScore" } } },
  ];

  const [interfaces, systems, owners] = await Promise.all([
    Interface.aggregate(pipeline()),
    System.aggregate(pipeline()),
    Owner.aggregate(pipeline()),
  ]);

  return { query: q, engine: "atlas-search", interfaces, systems, owners };
}

// Regex fallback: case-insensitive substring match across key fields.
async function searchRegex(q) {
  const rx = new RegExp(escapeRegex(q), "i");
  const [interfaces, systems, owners] = await Promise.all([
    Interface.find({
      $or: [
        { name: rx },
        { description: rx },
        { type: rx },
        { protocol: rx },
        { message_type: rx },
        { source: rx },
        { target: rx },
        { lifecycle: rx },
      ],
    })
      .limit(20)
      .lean(),
    System.find({
      $or: [{ name: rx }, { key: rx }, { description: rx }, { vendor: rx }, { kind: rx }],
    })
      .limit(20)
      .lean(),
    Owner.find({ $or: [{ name: rx }, { team: rx }, { key: rx }] })
      .limit(20)
      .lean(),
  ]);

  return { query: q, engine: "regex", interfaces, systems, owners };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
