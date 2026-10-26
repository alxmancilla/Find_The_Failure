import { Relationship } from "../models.js";
import { DEFAULT_ENVIRONMENT, DEFAULT_TENANT_ID } from "../demoDefaults.js";
import { normalizeLineageRecords } from "./ingestion.js";

const SCOPE = { tenant_id: DEFAULT_TENANT_ID, environment: DEFAULT_ENVIRONMENT };
const LINEAGE_TYPES = ["transforms_to", "carries", "produces", "consumes", "system_of_record"];
const DECISIONS = {
  confirmed: "Confirmed by data steward",
  rejected: "Rejected by data steward",
};

const formatReview = (edge) => ({
  key: edge.key,
  relationship_type: edge.relationship_type,
  from_key: edge.from_key,
  to_key: edge.to_key,
  source_system: edge.source_system,
  confirmed: edge.confirmed,
  confidence: edge.confidence,
  review: edge.review || null,
  review_history: edge.review_history || [],
});

// Local stewardship decision on a lineage edge. Confirmed edges become trusted;
// rejected edges are excluded from lineage traversal. No external system changes.
export async function reviewLineageEdge(edgeKey, { decision, note, actor } = {}) {
  if (!DECISIONS[decision]) return { error: `decision must be one of: ${Object.keys(DECISIONS).join(", ")}` };
  const edge = await Relationship.findOne({ key: edgeKey, relationship_type: { $in: LINEAGE_TYPES }, ...SCOPE }).lean();
  if (!edge) return null;
  const review = {
    status: decision,
    label: DECISIONS[decision],
    note: note || (decision === "confirmed" ? "Verified with the order-to-cash data steward." : "Not supported by current source evidence."),
    actor: actor || "Order-to-Cash Data Stewardship (demo)",
    at: new Date(),
    previous: { confirmed: edge.confirmed, confidence: edge.confidence },
  };
  const set = decision === "confirmed" ? { confirmed: true, confidence: 1 } : { confirmed: false };
  await Relationship.updateOne({ key: edgeKey }, { $set: { ...set, review }, $push: { review_history: review } });
  const updated = await Relationship.findOne({ key: edgeKey }).lean();
  return {
    edge: formatReview(updated),
    guardrail: "Local stewardship decision stored on the relationship; no external catalog is changed.",
    mongodb_trace: {
      collection: "relationships",
      operation: "updateOne",
      code: `db.relationships.updateOne({ key: ${JSON.stringify(edgeKey)} }, { $set: { ...${JSON.stringify(set)}, review: { status: ${JSON.stringify(decision)}, ... } }, $push: { review_history: { ... } } })`,
    },
  };
}

export async function listLineageReviews() {
  const edges = await Relationship.find({ "review.status": { $exists: true }, ...SCOPE }).sort({ "review.at": -1 }).lean();
  return { reviews: edges.map(formatReview) };
}

// Rehearsal reset: remove decisions and re-normalize so edges return to the
// confidence asserted by their source records.
export async function clearLineageReviews() {
  const result = await Relationship.updateMany({ "review.status": { $exists: true } }, { $unset: { review: "", review_history: "" } });
  const lineage = await normalizeLineageRecords();
  return { ok: true, cleared: result.modifiedCount || 0, lineage_relationship_upserts: lineage.relationship_upserts };
}
