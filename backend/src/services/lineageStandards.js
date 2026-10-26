import { createHash } from "node:crypto";
import { Interface, LineageFlow, Relationship } from "../models.js";
import { DEFAULT_ENVIRONMENT, DEFAULT_TENANT_ID } from "../demoDefaults.js";

const SCOPE = { tenant_id: DEFAULT_TENANT_ID, environment: DEFAULT_ENVIRONMENT };
const PRODUCER = "https://github.com/alxmancilla/Find_The_Failure";
const RUN_EVENT_SCHEMA = "https://openlineage.io/spec/2-0-2/OpenLineage.json#/$defs/RunEvent";
const COLUMN_LINEAGE_SCHEMA = "https://openlineage.io/spec/facets/1-1-0/ColumnLineageDatasetFacet.json";
const DOCUMENTATION_SCHEMA = "https://openlineage.io/spec/facets/1-0-1/DocumentationJobFacet.json";

// How the demo's collections and relationship types map to common metamodels.
export const LINEAGE_METAMODEL = {
  elements: [
    { collection: "systems", archimate: "Application Component", openlineage: "Job namespace / producer" },
    { collection: "interfaces", archimate: "Application Interface", openlineage: "Job" },
    { collection: "data_entities", archimate: "Data Object (Business Object for partner documents)", openlineage: "Dataset" },
    { collection: "business_processes", archimate: "Business Process", openlineage: "Job facet (business context)" },
    { collection: "owners", archimate: "Business Actor / Business Role", openlineage: "Ownership facet" },
    { collection: "message_events", archimate: "Application Event", openlineage: "Run" },
  ],
  relationships: [
    { type: "depends_on", from: "interface", to: "interface", archimate: "Flow", openlineage: "Job dependency (parent / child run)" },
    { type: "supports_process", from: "interface", to: "business_process", archimate: "Serving", openlineage: "Job facet" },
    { type: "carries", from: "interface", to: "data_entity", archimate: "Flow (carrying a Data Object)", openlineage: "Job input / output dataset" },
    { type: "transforms_to", from: "data_entity", to: "data_entity", archimate: "Flow between Data Objects (derivation)", openlineage: "Column lineage facet" },
    { type: "produces", from: "system", to: "data_entity", archimate: "Access (write)", openlineage: "Job output dataset" },
    { type: "consumes", from: "system", to: "data_entity", archimate: "Access (read)", openlineage: "Job input dataset" },
    { type: "system_of_record", from: "data_entity", to: "system", archimate: "Access (write, authoritative)", openlineage: "Dataset ownership facet" },
  ],
  notes: "Mapping is illustrative for architecture review; ArchiMate has no native derivation relationship, so transforms_to maps to a Flow between Data Objects.",
};

export function getLineageMetamodel() {
  return LINEAGE_METAMODEL;
}

const uuidFrom = (value) => {
  const h = createHash("sha1").update(value).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

// One OpenLineage RunEvent per flow hop. Job = interface, datasets = data
// entities, column lineage from the hop's current field mappings.
export async function exportFlowOpenLineage(flowKey) {
  const flow = await LineageFlow.findOne({ key: flowKey, ...SCOPE }).lean();
  if (!flow) return null;
  const path = flow.path || [];
  const [hops, interfaces] = await Promise.all([
    Relationship.find({ relationship_type: "carries", from_key: { $in: path }, ...SCOPE }).lean(),
    Interface.find({ key: { $in: path } }, { key: 1, name: 1, protocol: 1, message_type: 1, source: 1, target: 1 }).lean(),
  ]);
  const hopMap = new Map(hops.map((h) => [h.from_key, h]));
  const ifaceMap = new Map(interfaces.map((i) => [i.key, i]));
  const jobNamespace = `${DEFAULT_TENANT_ID}.${DEFAULT_ENVIRONMENT}.integrations`;
  const datasetNamespace = `${DEFAULT_TENANT_ID}.${DEFAULT_ENVIRONMENT}.${flow.domain}`;

  const events = path.filter((key) => hopMap.has(key)).map((key) => {
    const hop = hopMap.get(key);
    const iface = ifaceMap.get(key) || { key };
    const fields = Object.fromEntries((hop.field_mappings || []).map((m) => [m.target_path, {
      inputFields: [{ namespace: datasetNamespace, name: hop.input_entity, field: m.source_path }],
      transformationDescription: `${m.field} (${hop.mapping_version || "v1"})`,
    }]));
    return {
      eventType: "COMPLETE",
      eventTime: new Date(hop.last_seen_at || hop.updatedAt || Date.now()).toISOString(),
      producer: PRODUCER,
      schemaURL: RUN_EVENT_SCHEMA,
      run: { runId: uuidFrom(`${hop.key}:${hop.provenance?.ingestion_run_id || ""}`) },
      job: {
        namespace: jobNamespace,
        name: iface.key,
        facets: {
          documentation: { _producer: PRODUCER, _schemaURL: DOCUMENTATION_SCHEMA, description: `${iface.name}: ${hop.transformation}` },
        },
      },
      inputs: [{ namespace: datasetNamespace, name: hop.input_entity }],
      outputs: [{
        namespace: datasetNamespace,
        name: hop.output_entity,
        facets: { columnLineage: { _producer: PRODUCER, _schemaURL: COLUMN_LINEAGE_SCHEMA, fields } },
      }],
    };
  });
  return {
    flow: flow.key,
    format: "OpenLineage RunEvent",
    spec_version: "2-0-2",
    event_count: events.length,
    events,
    note: "Generated from MongoDB lineage relationships for interoperability review; not published to an external lineage backend.",
  };
}
