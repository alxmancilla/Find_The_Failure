import { ATLAS_RETRIEVAL_MODE } from "../config.js";
import { OperationalKnowledge } from "../models.js";
import { AUTO_EMBED_MODEL, INDEX_NAME, KNOWLEDGE_VECTOR_INDEX } from "./searchIndex.js";

const RERANK_MODEL = "rerank-2.5-lite";
const LIMIT = 5;
const CANDIDATES = 10;

export async function findRelatedContext(alert, iface, impact) {
  const query = buildRelatedContextQuery(alert, iface, impact);
  const attempts = retrievalAttempts(ATLAS_RETRIEVAL_MODE, query);

  for (const attempt of attempts) {
    try {
      const documents = await OperationalKnowledge.aggregate(attempt.pipeline);
      return relatedContextResult(query, attempt.engine, attempt.pipeline, documents);
    } catch (err) {
      console.warn(`[retrieval] ${attempt.engine} unavailable, falling back: ${err.message}`);
    }
  }

  return relatedContextResult(query, "local-keyword-fallback", null, await keywordFallback(query));
}

export function buildRelatedContextQuery(alert, iface, impact) {
  const processNames = (impact?.business_processes || []).map((p) => p.name).join(" ");
  return [
    alert?.payload?.reason,
    alert?.payload?.detail,
    alert?.payload?.message_type,
    iface?.name,
    iface?.description,
    iface?.message_type,
    processNames,
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function retrievalAttempts(mode, query) {
  const atlas = { engine: "atlas-search", pipeline: atlasSearchPipeline(query) };
  const atlasRerank = { engine: "atlas-search-rerank", pipeline: atlasSearchRerankPipeline(query) };
  const vectorRerank = { engine: "auto-embed-vector-rerank", pipeline: vectorRerankPipeline(query) };
  if (mode === "auto") return [vectorRerank, atlasRerank, atlas];
  if (mode === "vector-rerank") return [vectorRerank, atlas];
  if (mode === "atlas-rerank") return [atlasRerank, atlas];
  return [atlas];
}

function atlasSearchPipeline(query) {
  return [
    { $search: { index: INDEX_NAME, text: { query, path: ["title", "text", "tags", "interface_key", "business_process_key"], fuzzy: { maxEdits: 2 } } } },
    { $limit: CANDIDATES },
    { $addFields: { searchScore: { $meta: "searchScore" } } },
    projectContextFields(),
    { $limit: LIMIT },
  ];
}

function atlasSearchRerankPipeline(query) {
  return [
    ...atlasSearchPipeline(query).slice(0, 2),
    { $rerank: { model: RERANK_MODEL, query: { text: query }, path: ["title", "text"], numDocsToRerank: CANDIDATES } },
    { $addFields: { rerankScore: { $meta: "score" } } },
    projectContextFields(),
    { $limit: LIMIT },
  ];
}

function vectorRerankPipeline(query) {
  return [
    { $vectorSearch: { index: KNOWLEDGE_VECTOR_INDEX, path: "text", query: { text: query }, model: AUTO_EMBED_MODEL, numCandidates: CANDIDATES, limit: CANDIDATES } },
    { $addFields: { vectorScore: { $meta: "vectorSearchScore" } } },
    { $rerank: { model: RERANK_MODEL, query: { text: query }, path: ["title", "text"], numDocsToRerank: CANDIDATES } },
    { $addFields: { rerankScore: { $meta: "score" } } },
    projectContextFields(),
    { $limit: LIMIT },
  ];
}

function projectContextFields() {
  return {
    $project: {
      _id: 0,
      key: 1,
      type: 1,
      title: 1,
      text: 1,
      interface_key: 1,
      business_process_key: 1,
      source_system: 1,
      tags: 1,
      observed_at: 1,
      searchScore: 1,
      vectorScore: 1,
      rerankScore: 1,
    },
  };
}

async function keywordFallback(query) {
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 3);
  const docs = await OperationalKnowledge.find().lean();
  return docs
    .map((doc) => ({ ...doc, fallbackScore: terms.filter((term) => `${doc.title} ${doc.text} ${(doc.tags || []).join(" ")}`.toLowerCase().includes(term)).length }))
    .filter((doc) => doc.fallbackScore > 0)
    .sort((a, b) => b.fallbackScore - a.fallbackScore)
    .slice(0, LIMIT)
    .map(({ _id, __v, ...doc }) => doc);
}

function relatedContextResult(query, engine, pipeline, documents) {
  const isFallback = engine === "local-keyword-fallback";
  return {
    query,
    engine,
    documents: documents.map((doc) => ({ ...doc, snippet: doc.text?.slice(0, 220) })),
    trace_operation: {
      collection: "operational_knowledge",
      operation: isFallback ? "find" : "aggregate",
      ...(isFallback ? { filter: {} } : { pipeline }),
      code: isFallback ? "db.operational_knowledge.find({})" : `db.operational_knowledge.aggregate(${JSON.stringify(pipeline, null, 2)})`,
      purpose: engine.includes("rerank")
        ? "Retrieve related operational knowledge and rerank it for this alert context."
        : "Retrieve related operational knowledge for this alert context.",
    },
  };
}