import { DEFAULT_ENVIRONMENT, DEFAULT_TENANT_ID } from "../demoDefaults.js";
import { RECALL_FIXTURE_GROUP } from "./p2pLineageCatalog.js";

// Manufacturer recall notices captured as raw source records (fictional data).
const now = new Date();
const daysAgo = (d) => new Date(now.getTime() - d * 24 * 3600 * 1000);

const notice = ({ recall_id, lot_number, udi_device_identifier, product, reason, recall_class, issuedDaysAgo }) => ({
  key: `${RECALL_FIXTURE_GROUP}:supplier-recall-feed:${recall_id}`,
  tenant_id: DEFAULT_TENANT_ID,
  environment: DEFAULT_ENVIRONMENT,
  fixture_group: RECALL_FIXTURE_GROUP,
  source_system: "supplier-recall-feed",
  record_type: "recall",
  external_id: recall_id,
  entity_type: "data_entity",
  entity_key: "recall-notice",
  observed_at: daysAgo(issuedDaysAgo),
  ingestion_status: "pending",
  evidence: [`${recall_id}: ${product} lot ${lot_number} — ${reason}`],
  entity_resolution: { alias: "MERIDIAN", canonical_key: "meridian-medical", status: "resolved", confidence: 0.98, matched_by: "trading_partner_id" },
  provenance: {
    source_system: "supplier-recall-feed",
    source_id: recall_id,
    source_type: "recall",
    adapter: "supplier-recall-feed-adapter",
    captured_at: now,
    trust_level: "contractual",
  },
  payload: {
    recall_id,
    manufacturer: "meridian-medical",
    product,
    lot_number,
    udi_device_identifier,
    reason,
    recall_class,
    issued_at: daysAgo(issuedDaysAgo),
    sample_data: true,
  },
});

export const recallNotices = [
  notice({
    recall_id: "RCL-2026-014",
    lot_number: "L-2291",
    udi_device_identifier: "00812345000017",
    product: "IV-220 Infusion Set",
    reason: "Possible occlusion of the roller clamp may interrupt fluid delivery.",
    recall_class: "Class II",
    issuedDaysAgo: 1,
  }),
];
