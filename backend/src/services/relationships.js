import { BusinessProcess, Interface, Relationship } from "../models.js";

const edgeMatch = {
  from_type: "interface",
  to_type: "interface",
  relationship_type: "depends_on",
};

export async function traceInterfaceRelationships(interfaceKey, direction = "downstream") {
  const downstream = direction !== "upstream";
  const roots = await Relationship.aggregate([
    {
      $match: downstream
        ? { ...edgeMatch, from_key: interfaceKey }
        : { ...edgeMatch, to_key: interfaceKey },
    },
    {
      $graphLookup: {
        from: "relationships",
        startWith: downstream ? "$to_key" : "$from_key",
        connectFromField: downstream ? "to_key" : "from_key",
        connectToField: downstream ? "from_key" : "to_key",
        as: "chain",
        maxDepth: 20,
        depthField: "depth",
        restrictSearchWithMatch: edgeMatch,
      },
    },
  ]);

  const relationships = dedupeRelationships(
    roots.flatMap((root) => [{ ...root, depth: 0 }, ...(root.chain || [])])
  );
  const relatedKeys = new Set([interfaceKey]);
  relationships.forEach((rel) => relatedKeys.add(downstream ? rel.to_key : rel.from_key));

  const interfaces = await Interface.find({ key: { $in: [...relatedKeys] } }).lean();
  return {
    type: "interface",
    key: interfaceKey,
    direction,
    relationships,
    interfaces,
    data_quality: summarizeRelationships(relationships),
  };
}

export async function getBusinessProcessContext(interfaceKeys) {
  const relationships = await Relationship.find({
    from_type: "interface",
    from_key: { $in: interfaceKeys },
    to_type: "business_process",
    relationship_type: "supports_process",
  }).lean();
  const processKeys = [...new Set(relationships.map((r) => r.to_key))];
  const business_processes = await BusinessProcess.find({ key: { $in: processKeys } }).lean();
  return { business_processes, relationships };
}

export function summarizeRelationships(relationships) {
  if (!relationships.length) return { total: 0, confirmed: 0, inferred: 0, average_confidence: null };
  const confirmed = relationships.filter((r) => r.confirmed).length;
  const confidence = relationships.reduce((sum, r) => sum + (r.confidence ?? 0), 0);
  return {
    total: relationships.length,
    confirmed,
    inferred: relationships.length - confirmed,
    average_confidence: Number((confidence / relationships.length).toFixed(2)),
    sources: [...new Set(relationships.map((r) => r.source_system).filter(Boolean))],
  };
}

function dedupeRelationships(relationships) {
  const seen = new Set();
  return relationships.filter((rel) => {
    if (seen.has(rel.key)) return false;
    seen.add(rel.key);
    delete rel.chain;
    return true;
  });
}