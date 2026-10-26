import { DataEntity, Interface, LineageFlow, Owner, Relationship, System } from "../models.js";
import { DEFAULT_ENVIRONMENT, DEFAULT_TENANT_ID } from "../demoDefaults.js";
import { GRAPH_LOOKUP_MAX_DEPTH } from "./graphConfig.js";
import { getBusinessProcessContext, summarizeRelationships } from "./relationships.js";

const DEFAULT_FLOW = "order-to-cash";
const SCOPE = { tenant_id: DEFAULT_TENANT_ID, environment: DEFAULT_ENVIRONMENT };
const CONTEXT_TYPES = ["produces", "consumes", "carries", "system_of_record"];
const transformMatch = { relationship_type: "transforms_to", ...SCOPE };

const loadFlow = (flowKey = DEFAULT_FLOW) => LineageFlow.findOne({ key: flowKey, ...SCOPE }).lean();
const rank = (order, key) => { const i = order.indexOf(key); return i === -1 ? order.length : i; };
const entityOrder = (flow) => (a, b) => rank(flow?.entity_order || [], a.key) - rank(flow?.entity_order || [], b.key);

export async function listLineageFlows() {
  const flows = await LineageFlow.find(SCOPE).lean();
  return { flows };
}

export async function listLineageEntities(flowKey = DEFAULT_FLOW) {
  const flow = await loadFlow(flowKey);
  if (!flow) return null;
  const entities = await DataEntity.find({ domain: flow.domain }).lean();
  return { flow: flow.key, entities: entities.sort(entityOrder(flow)) };
}

export function lineagePipeline(entityKey, domain = DEFAULT_FLOW) {
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
    { $match: { key: entityKey, domain } },
    lookup("downstream", "to_key", "from_key"),
    lookup("upstream", "from_key", "to_key"),
  ];
}

export async function traceLineage(entityKey, direction = "both", flowKey = DEFAULT_FLOW) {
  const flow = await loadFlow(flowKey);
  if (!flow) return null;
  const byEntityOrder = entityOrder(flow);
  const order = flow.entity_order || [];
  const pipeline = lineagePipeline(entityKey, flow.domain);
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
    ...SCOPE,
    $or: [
      { to_type: "data_entity", to_key: { $in: [...entityKeys] } },
      { from_type: "data_entity", from_key: { $in: [...entityKeys] } },
    ],
  }).lean();

  const interfaceKeys = new Set([...transformationsByKey.values()].map((rel) => rel.interface_key).filter(Boolean));
  context.filter((rel) => rel.relationship_type === "carries").forEach((rel) => interfaceKeys.add(rel.from_key));

  const [entities, interfaces] = await Promise.all([
    DataEntity.find({ key: { $in: [...entityKeys] } }).lean(),
    Interface.find({ key: { $in: [...interfaceKeys] } }, { key: 1, name: 1, protocol: 1, message_type: 1, source: 1, target: 1, middleware: 1, owners: 1 }).lean(),
  ]);
  const ifaceMap = new Map(interfaces.map((i) => [i.key, i]));

  const systemKeys = new Set();
  context.forEach((rel) => { if (rel.from_type === "system") systemKeys.add(rel.from_key); if (rel.to_type === "system") systemKeys.add(rel.to_key); });
  interfaces.forEach((i) => { systemKeys.add(i.source); systemKeys.add(i.target); (i.middleware || []).forEach((m) => systemKeys.add(m)); });
  transformationsByKey.forEach((rel) => rel.transformed_by && systemKeys.add(rel.transformed_by));
  const ownerKeys = new Set([...interfaces.flatMap((i) => i.owners || []), ...entities.map((e) => e.data_owner).filter(Boolean)]);
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
      data_owner: owners.find((o) => o.key === entity.data_owner) || null,
      produced_by: rels("produces").map((rel) => brief(rel.from_key)),
      consumed_by: rels("consumes").map((rel) => brief(rel.from_key)),
      carried_by: rels("carries").map((rel) => ifaceMap.get(rel.from_key)).filter(Boolean).map(briefIface),
      selected: entity.key === entityKey,
    };
  });

  const transformations = [...transformationsByKey.values()]
    .sort((a, b) => rank(order, a.from_key) - rank(order, b.from_key) || rank(order, a.to_key) - rank(order, b.to_key))
    .map((rel) => {
      const iface = rel.interface_key ? ifaceMap.get(rel.interface_key) : null;
      const mappings = rel.field_mappings || [];
      return {
        key: rel.key,
        from_key: rel.from_key,
        to_key: rel.to_key,
        direction: rel.direction,
        hop: rel.hop,
        interface: iface ? briefIface(iface) : null,
        via: (iface?.middleware || []).map(brief),
        collapsed_steps: Boolean(iface?.middleware?.length),
        transformed_by: brief(rel.transformed_by),
        transformation: rel.transformation,
        field_mappings: mappings,
        po_number_mapping: mappings.find((m) => m.field === "po_number") || null,
        owners: owners.filter((o) => (iface?.owners || []).includes(o.key)),
        confidence: rel.confidence,
        confirmed: rel.confirmed,
        source_system: rel.source_system,
        source_record_id: rel.source_record_id,
        ingestion_run_id: rel.provenance?.ingestion_run_id || null,
        evidence: rel.evidence || [],
      };
    });

  const entityName = new Map(entities.map((e) => [e.key, e.name]));
  return {
    flow: flow.key,
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
    summary: `${entityName.get(entityKey)} connects to ${entities.length - 1} ${flow.name.toLowerCase()} entities through ${transformations.length} transformations.`,
    data_quality: summarizeRelationships([...transformationsByKey.values()]),
    mongodb_trace: {
      collection: "data_entities",
      operation: "aggregate",
      pipeline,
      purpose: "Traverse transforms_to lineage edges upstream and downstream with $graphLookup, then hydrate produces/consumes/carries/system_of_record context.",
    },
  };
}

// Ordered end-to-end path for a flow document ("follow the PO number"). Hop
// attributes come from `carries` edges, the canonical record of each interface hop.
export async function getLineageFlow(flowKey = DEFAULT_FLOW) {
  const flow = await loadFlow(flowKey);
  if (!flow) return null;
  const path = flow.path || [];
  const [interfaces, hops] = await Promise.all([
    Interface.find({ key: { $in: path } }).lean(),
    Relationship.find({ relationship_type: "carries", from_key: { $in: path }, ...SCOPE }).lean(),
  ]);
  const ifaceMap = new Map(interfaces.map((i) => [i.key, i]));
  const hopMap = new Map(hops.map((h) => [h.from_key, h]));
  const ordered = path.map((key) => ifaceMap.get(key)).filter(Boolean);
  const systemKeys = new Set(ordered.flatMap((i) => [i.source, i.target, hopMap.get(i.key)?.transformed_by, ...(i.middleware || [])]).filter(Boolean));
  const entityKeys = new Set(hops.flatMap((h) => [h.input_entity, h.output_entity]).filter(Boolean));
  const ownerKeys = new Set(ordered.flatMap((i) => i.owners || []));
  const [systems, entities, owners, inferred] = await Promise.all([
    System.find({ key: { $in: [...systemKeys] } }, { key: 1, name: 1, kind: 1 }).lean(),
    DataEntity.find({ key: { $in: [...entityKeys] } }, { key: 1, name: 1, entity_kind: 1, system_of_record: 1 }).lean(),
    Owner.find({ key: { $in: [...ownerKeys] } }, { key: 1, name: 1 }).lean(),
    Relationship.find({ ...transformMatch, flow: flow.key, confirmed: false }).lean(),
  ]);
  const sys = new Map(systems.map((s) => [s.key, s]));
  const ent = new Map(entities.map((e) => [e.key, e]));
  const steps = ordered.map((iface, index) => {
    const hop = hopMap.get(iface.key) || {};
    const mappings = hop.field_mappings || [];
    return {
      step: index + 1,
      interface: { key: iface.key, name: iface.name, protocol: iface.protocol, message_type: iface.message_type },
      from_system: sys.get(iface.source) || { key: iface.source },
      to_system: sys.get(iface.target) || { key: iface.target },
      via: (iface.middleware || []).map((key) => sys.get(key) || { key }),
      input_entity: ent.get(hop.input_entity) || null,
      output_entity: ent.get(hop.output_entity) || null,
      transformed_by: sys.get(hop.transformed_by) || null,
      transformation: hop.transformation,
      changes_shape: hop.input_entity !== hop.output_entity,
      identifier_mapping: mappings.find((m) => m.field === flow.identifier) || null,
      po_number_mapping: mappings.find((m) => m.field === "po_number") || null,
      field_mappings: mappings,
      owners: owners.filter((o) => (iface.owners || []).includes(o.key)),
      source_record_id: hop.source_record_id,
    };
  });
  return {
    flow: flow.key,
    name: flow.name,
    description: flow.description,
    identifier: flow.identifier,
    steps,
    entities: entities.sort(entityOrder(flow)),
    inferred_edges: inferred.map((rel) => ({ key: rel.key, from_key: rel.from_key, to_key: rel.to_key, confidence: rel.confidence, source_system: rel.source_system, evidence: rel.evidence })),
    summary: `The ${flow.identifier_label || flow.identifier} is carried through ${steps.filter((s) => s.identifier_mapping).length} of ${steps.length} ${flow.name.toLowerCase()} hops.`,
  };
}

function downstreamEntitiesPipeline(entityKeys, domain) {
  return [
    { $match: { key: { $in: entityKeys }, domain } },
    {
      $graphLookup: {
        from: "relationships",
        startWith: "$key",
        connectFromField: "to_key",
        connectToField: "from_key",
        as: "downstream",
        maxDepth: GRAPH_LOOKUP_MAX_DEPTH,
        restrictSearchWithMatch: transformMatch,
      },
    },
    { $project: { key: 1, "downstream.key": 1, "downstream.to_key": 1, "downstream.interface_key": 1, "downstream.confirmed": 1 } },
  ];
}

async function reachableDownstream(entityKeys, domain) {
  const pipeline = downstreamEntitiesPipeline(entityKeys, domain);
  const roots = entityKeys.length ? await DataEntity.aggregate(pipeline) : [];
  const edges = [...new Map(roots.flatMap((r) => r.downstream || []).map((e) => [e.key, e])).values()];
  return { code: `db.data_entities.aggregate(${JSON.stringify(pipeline, null, 2)})`, edges };
}

const orderedEntities = (keys, flow) => DataEntity.find({ key: { $in: [...keys] } }, { key: 1, name: 1, entity_kind: 1, system_of_record: 1 }).lean().then((list) => list.sort(entityOrder(flow)));

// Lineage-derived consequence of interface failures: which documents can no
// longer be produced downstream. Additive to depends_on impact; never alters it.
export async function getDataImpact(interfaceKeys, flowKey = DEFAULT_FLOW) {
  const flow = await loadFlow(flowKey);
  const domain = flow?.domain || flowKey;
  const hops = await Relationship.find({ relationship_type: "carries", from_key: { $in: interfaceKeys }, flow: flowKey, ...SCOPE }, { output_entity: 1 }).lean();
  const originKeys = [...new Set(hops.map((h) => h.output_entity).filter(Boolean))];
  const { code, edges } = await reachableDownstream(originKeys, domain);
  const downstreamKeys = new Set(edges.map((e) => e.to_key).filter((k) => !originKeys.includes(k)));
  const atRiskInterfaceKeys = [...new Set(edges.map((e) => e.interface_key).filter((k) => k && !interfaceKeys.includes(k)))];
  const [origin, downstream, interfaces, processContext] = await Promise.all([
    orderedEntities(originKeys, flow),
    orderedEntities(downstreamKeys, flow),
    Interface.find({ key: { $in: atRiskInterfaceKeys } }, { key: 1, name: 1, protocol: 1, message_type: 1 }).lean(),
    getBusinessProcessContext(atRiskInterfaceKeys),
  ]);
  const inferred = edges.filter((e) => e.confirmed === false);
  return {
    origin_entities: origin,
    entities_at_risk: downstream,
    interfaces_at_risk: interfaces,
    business_processes: processContext.business_processes,
    inferred_edges: inferred.length,
    summary: origin.length
      ? `${origin.map((e) => e.name).join(", ")} may not be produced; ${downstream.length} downstream document${downstream.length === 1 ? "" : "s"} at risk${downstream.length ? `: ${downstream.map((e) => e.name).join(", ")}` : ""}.`
      : "No order-to-cash lineage passes through the impacted interfaces.",
    mongodb_trace: { collection: "data_entities", operation: "aggregate", code, purpose: "Follow scoped transforms_to edges downstream from entities the failed interfaces produce." },
  };
}

// Modernization: what lineage a system performs, produces, or masters.
export async function getSystemLineageImpact(systemKey, flowKey = DEFAULT_FLOW) {
  const flow = await loadFlow(flowKey);
  const domain = flow?.domain || flowKey;
  const lineageInterfaceKeys = await Relationship.distinct("from_key", { relationship_type: "carries", flow: flowKey, ...SCOPE });
  const [performed, produced, mastered, middleware] = await Promise.all([
    Relationship.find({ ...transformMatch, transformed_by: systemKey }).lean(),
    Relationship.find({ relationship_type: "produces", from_key: systemKey, ...SCOPE }).lean(),
    Relationship.find({ relationship_type: "system_of_record", to_key: systemKey, ...SCOPE }).lean(),
    Interface.find({ middleware: systemKey, key: { $in: lineageInterfaceKeys } }, { key: 1, name: 1, protocol: 1, message_type: 1, source: 1, target: 1 }).lean(),
  ]);
  const producedKeys = [...new Set(produced.map((r) => r.to_key))];
  const { code, edges } = await reachableDownstream(producedKeys, domain);
  const dependentKeys = new Set(edges.map((e) => e.to_key).filter((k) => !producedKeys.includes(k)));
  const ifaceKeys = [...new Set(performed.map((r) => r.interface_key).filter(Boolean))];
  const [producedEntities, masteredEntities, dependentEntities, performedIfaces] = await Promise.all([
    orderedEntities(producedKeys, flow),
    orderedEntities(mastered.map((r) => r.from_key), flow),
    orderedEntities(dependentKeys, flow),
    Interface.find({ key: { $in: ifaceKeys } }, { key: 1, name: 1, protocol: 1, message_type: 1 }).lean(),
  ]);
  const ifaceMap = new Map(performedIfaces.map((i) => [i.key, i]));
  const transformations = performed.map((r) => {
    const iface = ifaceMap.get(r.interface_key);
    return {
      key: r.key,
      from_key: r.from_key,
      to_key: r.to_key,
      interface: iface ? { key: iface.key, name: iface.name, protocol: iface.protocol, message_type: iface.message_type } : null,
      transformation: r.transformation,
      field_mappings: r.field_mappings || [],
      confirmed: r.confirmed,
      confidence: r.confidence,
    };
  });
  const mappingCount = transformations.reduce((sum, t) => sum + t.field_mappings.length, 0);
  return {
    transformations,
    produced_entities: producedEntities,
    mastered_entities: masteredEntities,
    dependent_entities: dependentEntities,
    translation_hops: middleware,
    summary: {
      transformation_count: transformations.length,
      field_mapping_count: mappingCount,
      produced_count: producedEntities.length,
      mastered_count: masteredEntities.length,
      dependent_count: dependentEntities.length,
      translation_hop_count: middleware.length,
    },
    mongodb_trace: { collection: "data_entities", operation: "aggregate", code, purpose: "Follow scoped transforms_to edges downstream from entities this system produces." },
  };
}
