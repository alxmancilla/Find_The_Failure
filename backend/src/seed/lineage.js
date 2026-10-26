import { interfaces } from "./interfaces.js";
import { dataEntities } from "./base.js";

// Operational lineage edges for the order-to-cash flow. These use lineage-only
// relationship types so existing depends_on impact traversal is unchanged.
export const LINEAGE_RELATIONSHIP_TYPES = ["produces", "carries", "transforms_to", "consumes", "system_of_record"];

const now = new Date();
const daysAgo = (d) => new Date(now.getTime() - d * 24 * 3600 * 1000);

const edge = (r) => ({
  confidence: 1,
  confirmed: true,
  source_system: "seed-integration-inventory",
  environment: "production",
  flow: "order-to-cash",
  first_seen_at: now,
  last_seen_at: now,
  ...r,
});

const lineageInterfaces = interfaces.filter((iface) => iface.lineage?.flow === "order-to-cash");

const dedupe = (edges) => [...new Map(edges.map((e) => [e.key, e])).values()];

const transformsTo = lineageInterfaces
  .filter((iface) => iface.lineage.input_entity !== iface.lineage.output_entity)
  .map((iface) => edge({
    key: `${iface.lineage.input_entity}->${iface.lineage.output_entity}:transforms_to:${iface.key}`,
    from_type: "data_entity",
    from_key: iface.lineage.input_entity,
    to_type: "data_entity",
    to_key: iface.lineage.output_entity,
    relationship_type: "transforms_to",
    interface_key: iface.key,
    transformed_by: iface.lineage.transformed_by,
    transformation: iface.lineage.transformation,
    source_record_id: `${iface.key}.lineage`,
    evidence: [`${iface.name} lineage maps ${iface.lineage.input_entity} to ${iface.lineage.output_entity}.`],
  }));

const carries = lineageInterfaces.flatMap((iface) =>
  [...new Set([iface.lineage.input_entity, iface.lineage.output_entity])].map((entityKey) => edge({
    key: `${iface.key}->${entityKey}:carries`,
    from_type: "interface",
    from_key: iface.key,
    to_type: "data_entity",
    to_key: entityKey,
    relationship_type: "carries",
    source_record_id: `${iface.key}.lineage`,
    evidence: [`${iface.name} carries ${entityKey}.`],
  }))
);

const produces = lineageInterfaces.map((iface) => edge({
  key: `${iface.lineage.transformed_by}->${iface.lineage.output_entity}:produces`,
  from_type: "system",
  from_key: iface.lineage.transformed_by,
  to_type: "data_entity",
  to_key: iface.lineage.output_entity,
  relationship_type: "produces",
  source_record_id: `${iface.key}.lineage.transformed_by`,
  evidence: [`${iface.lineage.transformed_by} produces ${iface.lineage.output_entity} (${iface.name}).`],
}));

const consumes = lineageInterfaces.map((iface) => edge({
  key: `${iface.target}->${iface.lineage.output_entity}:consumes`,
  from_type: "system",
  from_key: iface.target,
  to_type: "data_entity",
  to_key: iface.lineage.output_entity,
  relationship_type: "consumes",
  source_record_id: `${iface.key}.target`,
  evidence: [`${iface.target} receives ${iface.lineage.output_entity} through ${iface.name}.`],
}));

const systemOfRecord = dataEntities
  .filter((entity) => entity.domain === "order-to-cash" && entity.system_of_record)
  .map((entity) => edge({
    key: `${entity.key}->${entity.system_of_record}:system_of_record`,
    from_type: "data_entity",
    from_key: entity.key,
    to_type: "system",
    to_key: entity.system_of_record,
    relationship_type: "system_of_record",
    source_record_id: `${entity.key}.system_of_record`,
    evidence: [`${entity.name} is mastered in ${entity.system_of_record}.`],
  }));

// Inferred from a legacy lineage workbook; demonstrates trust signals.
const inferred = edge({
  key: "advance-ship-notice->invoice:transforms_to:legacy-lineage-workbook",
  from_type: "data_entity",
  from_key: "advance-ship-notice",
  to_type: "data_entity",
  to_key: "invoice",
  relationship_type: "transforms_to",
  interface_key: null,
  transformed_by: "apex-erp",
  transformation: "Invoice quantities appear to be billed as shipped from the ship notice.",
  confidence: 0.6,
  confirmed: false,
  source_system: "legacy-lineage-workbook",
  source_record_id: "legacy-lineage-workbook:O2C-ROW-17",
  first_seen_at: daysAgo(210),
  last_seen_at: daysAgo(210),
  evidence: ["Legacy lineage workbook row O2C-ROW-17 links ASN quantities to invoice lines; requires SME confirmation."],
});

export const lineageRelationships = dedupe([
  ...transformsTo,
  inferred,
  ...carries,
  ...produces,
  ...consumes,
  ...systemOfRecord,
]);
