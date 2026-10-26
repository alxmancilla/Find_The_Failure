import { DataEntity, Interface, Owner, Relationship, System } from "../models.js";
import { GRAPH_LOOKUP_MAX_DEPTH } from "./graphConfig.js";
import { summarizeRelationships } from "./relationships.js";

const FLOW = "order-to-cash";
const ENTITY_ORDER = [
  "purchase-order", "canonical-order", "sales-order", "inventory-request", "order-status",
  "order-ack", "advance-ship-notice", "invoice", "payment-remittance",
];
const ORDER_TO_CASH_PATH = [
  "if-hospital-850", "if-gateway-x12", "if-x12-integration", "if-integration-erp",
  "if-erp-inventory", "if-erp-855", "if-erp-856", "if-erp-810", "if-hospital-820",
];
const CONTEXT_TYPES = ["produces", "consumes", "carries", "system_of_record"];
const transformMatch = { relationship_type: "transforms_to" };
const byEntityOrder = (a, b) => ENTITY_ORDER.indexOf(a.key) - ENTITY_ORDER.indexOf(b.key);

export async function listLineageEntities() {
  const entities = await DataEntity.find({ domain: FLOW }).lean();
  return { flow: FLOW, entities: entities.sort(byEntityOrder) };
}

export function lineagePipeline(entityKey) {
  const lookup = (as, connectFromField, connectToField) => ({
    $graphLookup: {
      from: "relationships",
      startWith: "$key",
      connectFromField,
      connectToField,
      as,
      maxDepth: GRAPH_LOOKUP_MAX_DEPTH,
      depthField: "depth",
      restrictSearchWithMatch: transformMatch,
    },
  });
  return [
    { $match: { key: entityKey, domain: FLOW } },
    lookup("downstream", "to_key", "from_key"),
    lookup("upstream", "from_key", "to_key"),
  ];
}

export async function traceLineage(entityKey, direction = "both") {
  const pipeline = lineagePipeline(entityKey);
  const [root] = await DataEntity.aggregate(pipeline);
  if (!root) return null;

  const pick = (list, dir) => (list || []).map((rel) => ({ ...rel, direction: dir, hop: rel.depth + 1 }));
  const transformationsRaw = [
    ...(direction !== "upstream" ? pick(root.downstream, "downstream") : []),
    ...(direction !== "downstream" ? pick(root.upstream, "upstream") : []),
  ];
  const transformationsByKey = new Map(transformationsRaw.map((rel) => [rel.key, rel]));
  const entityKeys = new Set([entityKey]);
  transformationsByKey.forEach((rel) => { entityKeys.add(rel.from_key); entityKeys.add(rel.to_key); });

  const context = await Relationship.find({
    relationship_type: { $in: CONTEXT_TYPES },
    $or: [
      { to_type: "data_entity", to_key: { $in: [...entityKeys] } },
      { from_type: "data_entity", from_key: { $in: [...entityKeys] } },
    ],
  }).lean();

  const interfaceKeys = new Set([...transformationsByKey.values()].map((rel) => rel.interface_key).filter(Boolean));
  context.filter((rel) => rel.relationship_type === "carries").forEach((rel) => interfaceKeys.add(rel.from_key));

  const [entities, interfaces] = await Promise.all([
    DataEntity.find({ key: { $in: [...entityKeys] } }).lean(),
    Interface.find({ key: { $in: [...interfaceKeys] } }, { key: 1, name: 1, protocol: 1, message_type: 1, source: 1, target: 1, owners: 1, lineage: 1 }).lean(),
  ]);
  const ifaceMap = new Map(interfaces.map((i) => [i.key, i]));

  const systemKeys = new Set();
  context.forEach((rel) => { if (rel.from_type === "system") systemKeys.add(rel.from_key); if (rel.to_type === "system") systemKeys.add(rel.to_key); });
  interfaces.forEach((i) => { systemKeys.add(i.source); systemKeys.add(i.target); });
  const ownerKeys = new Set(interfaces.flatMap((i) => i.owners || []));
  const [systems, owners] = await Promise.all([
    System.find({ key: { $in: [...systemKeys] } }, { key: 1, name: 1, kind: 1, owner: 1 }).lean(),
    Owner.find({ key: { $in: [...ownerKeys] } }, { key: 1, name: 1, team: 1 }).lean(),
  ]);
  const systemMap = new Map(systems.map((s) => [s.key, s]));
  const brief = (key) => systemMap.get(key) || { key, name: key };
  const briefIface = (i) => ({ key: i.key, name: i.name, protocol: i.protocol, message_type: i.message_type });

  const enrichedEntities = entities.sort(byEntityOrder).map((entity) => {
    const rels = (type) => context.filter((rel) => rel.relationship_type === type && (rel.to_key === entity.key || rel.from_key === entity.key));
    return {
      ...entity,
      system_of_record: entity.system_of_record ? brief(entity.system_of_record) : null,
      produced_by: rels("produces").map((rel) => brief(rel.from_key)),
      consumed_by: rels("consumes").map((rel) => brief(rel.from_key)),
      carried_by: rels("carries").map((rel) => ifaceMap.get(rel.from_key)).filter(Boolean).map(briefIface),
      selected: entity.key === entityKey,
    };
  });

  const transformations = [...transformationsByKey.values()]
    .sort((a, b) => ENTITY_ORDER.indexOf(a.from_key) - ENTITY_ORDER.indexOf(b.from_key) || ENTITY_ORDER.indexOf(a.to_key) - ENTITY_ORDER.indexOf(b.to_key))
    .map((rel) => {
      const iface = rel.interface_key ? ifaceMap.get(rel.interface_key) : null;
      const mappings = iface?.lineage?.field_mappings || [];
      return {
        key: rel.key,
        from_key: rel.from_key,
        to_key: rel.to_key,
        direction: rel.direction,
        hop: rel.hop,
        interface: iface ? briefIface(iface) : null,
        transformed_by: brief(rel.transformed_by),
        transformation: rel.transformation,
        field_mappings: mappings,
        po_number_mapping: mappings.find((m) => m.field === "po_number") || null,
        owners: owners.filter((o) => (iface?.owners || []).includes(o.key)),
        confidence: rel.confidence,
        confirmed: rel.confirmed,
        source_system: rel.source_system,
        source_record_id: rel.source_record_id,
        evidence: rel.evidence || [],
      };
    });

  const entityName = new Map(entities.map((e) => [e.key, e.name]));
  return {
    flow: FLOW,
    entity: enrichedEntities.find((e) => e.selected),
    direction,
    entities: enrichedEntities,
    transformations,
    systems,
    owners,
    graph: {
      startKey: entityKey,
      nodes: enrichedEntities.map((e) => ({ id: e.key, type: "system", data: { key: e.key, label: e.name, kind: e.system_of_record ? `SoR: ${e.system_of_record.name}` : e.entity_kind } })),
      edges: transformations.map((t) => ({
        id: t.key,
        source: t.from_key,
        target: t.to_key,
        data: { label: t.interface?.name || `Inferred: ${t.source_system}`, protocol: t.interface ? `${t.interface.protocol} ${t.interface.message_type}` : `${Math.round(t.confidence * 100)}% confidence`, confirmed: t.confirmed },
      })),
    },
    summary: `${entityName.get(entityKey)} connects to ${entities.length - 1} order-to-cash entities through ${transformations.length} transformations.`,
    data_quality: summarizeRelationships([...transformationsByKey.values()]),
    mongodb_trace: {
      collection: "data_entities",
      operation: "aggregate",
      pipeline,
      purpose: "Traverse transforms_to lineage edges upstream and downstream with $graphLookup, then hydrate produces/consumes/carries/system_of_record context.",
    },
  };
}

// Ordered end-to-end order-to-cash path for the "follow the PO number" story.
export async function getOrderToCashFlow() {
  const interfaces = await Interface.find({ key: { $in: ORDER_TO_CASH_PATH } }).lean();
  const ifaceMap = new Map(interfaces.map((i) => [i.key, i]));
  const ordered = ORDER_TO_CASH_PATH.map((key) => ifaceMap.get(key)).filter(Boolean);
  const systemKeys = new Set(ordered.flatMap((i) => [i.source, i.target, i.lineage?.transformed_by]).filter(Boolean));
  const entityKeys = new Set(ordered.flatMap((i) => [i.lineage?.input_entity, i.lineage?.output_entity]).filter(Boolean));
  const ownerKeys = new Set(ordered.flatMap((i) => i.owners || []));
  const [systems, entities, owners, inferred] = await Promise.all([
    System.find({ key: { $in: [...systemKeys] } }, { key: 1, name: 1, kind: 1 }).lean(),
    DataEntity.find({ key: { $in: [...entityKeys] } }, { key: 1, name: 1, entity_kind: 1, system_of_record: 1 }).lean(),
    Owner.find({ key: { $in: [...ownerKeys] } }, { key: 1, name: 1 }).lean(),
    Relationship.find({ ...transformMatch, flow: FLOW, confirmed: false }).lean(),
  ]);
  const sys = new Map(systems.map((s) => [s.key, s]));
  const ent = new Map(entities.map((e) => [e.key, e]));
  const steps = ordered.map((iface, index) => ({
    step: index + 1,
    interface: { key: iface.key, name: iface.name, protocol: iface.protocol, message_type: iface.message_type },
    from_system: sys.get(iface.source) || { key: iface.source },
    to_system: sys.get(iface.target) || { key: iface.target },
    input_entity: ent.get(iface.lineage?.input_entity) || null,
    output_entity: ent.get(iface.lineage?.output_entity) || null,
    transformed_by: sys.get(iface.lineage?.transformed_by) || null,
    transformation: iface.lineage?.transformation,
    changes_shape: iface.lineage?.input_entity !== iface.lineage?.output_entity,
    po_number_mapping: (iface.lineage?.field_mappings || []).find((m) => m.field === "po_number") || null,
    field_mappings: iface.lineage?.field_mappings || [],
    owners: owners.filter((o) => (iface.owners || []).includes(o.key)),
  }));
  return {
    flow: FLOW,
    identifier: "po_number",
    steps,
    entities: entities.sort(byEntityOrder),
    inferred_edges: inferred.map((rel) => ({ key: rel.key, from_key: rel.from_key, to_key: rel.to_key, confidence: rel.confidence, source_system: rel.source_system, evidence: rel.evidence })),
    summary: `The PO number is carried through ${steps.filter((s) => s.po_number_mapping).length} of ${steps.length} order-to-cash hops.`,
  };
}
