import mongoose from "mongoose";

const { Schema, model } = mongoose;

// Owners / support teams responsible for interfaces & systems
const ownerSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    team: String,
    email: String,
    slack: String,
    on_call: String,
    runbook_url: String,
  },
  { collection: "owners", timestamps: true }
);

// Systems: source, target, and middleware components in the landscape
const systemSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    kind: String, // source | middleware | translator | api | target | service
    description: String,
    vendor: String,
    owner: { type: String, ref: "Owner" }, // owner.key
  },
  { collection: "systems", timestamps: true }
);

// Data entities / business terms flowing across interfaces
const dataEntitySchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: String,
    business_terms: [String],
  },
  { collection: "data_entities", timestamps: true }
);

// Interfaces: flexible metadata for EDI, REST, FHIR, events, SFTP, etc.
// strict:false lets each interface type carry its own extra fields.
const interfaceSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: String,
    type: String, // EDI | REST | FHIR | EVENT | SFTP
    protocol: String, // X12 | HTTPS | HL7-FHIR | Kafka | SFTP
    message_type: String, // 850 | 855 | etc.
    source: { type: String, ref: "System" }, // system.key
    target: { type: String, ref: "System" }, // system.key
    middleware: [{ type: String, ref: "System" }], // ordered pipeline of system.keys
    data_entities: [{ type: String, ref: "DataEntity" }],
    owners: [{ type: String, ref: "Owner" }],
    downstream_systems: [{ type: String, ref: "System" }],
    downstream_interfaces: [String], // interface.key for graph traversal
    lifecycle: String, // production | deprecated | development
    version: String,
    sla: String,
    last_status: { type: String, default: "healthy" }, // healthy | failed | degraded
    last_success_at: Date,
    business_impact: String,
  },
  { collection: "interfaces", timestamps: true, strict: false }
);

interfaceSchema.index({
  name: "text",
  description: "text",
  type: "text",
  protocol: "text",
  source: "text",
  target: "text",
});

// Events: operational history stored alongside metadata
const eventSchema = new Schema(
  {
    interface_key: { type: String, ref: "Interface" },
    timestamp: { type: Date, default: Date.now },
    status: String, // success | failed | degraded
    message_type: String,
    reason: String,
    detail: String,
    severity: String, // info | warning | critical
  },
  { collection: "events", timestamps: true }
);

export const Owner = model("Owner", ownerSchema);
export const System = model("System", systemSchema);
export const DataEntity = model("DataEntity", dataEntitySchema);
export const Interface = model("Interface", interfaceSchema);
export const Event = model("Event", eventSchema);
