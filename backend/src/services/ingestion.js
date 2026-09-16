import { Event, Interface, Relationship, SourceRecord } from "../models.js";
import { buildEnterpriseFixtureSourceRecords, ENTERPRISE_FIXTURE_GROUP } from "./ingestionFixtures.js";

const STALE_DAYS = 45;

export async function getIngestionDashboard() {
  const [source_records, quality] = await Promise.all([
    SourceRecord.find().sort({ source_system: 1, external_id: 1 }).lean(),
    getDataQuality(),
  ]);
  return {
    source_records,
    quality,
    summary: summarizeSourceRecords(source_records),
    pipeline: buildPipeline(source_records, quality),
  };
}

export async function loadEnterpriseFixtures() {
  const records = buildEnterpriseFixtureSourceRecords();
  await SourceRecord.bulkWrite(
    records.map((record) => ({
      updateOne: {
        filter: { key: record.key },
        update: { $set: record, $unset: { workbench_lifecycle: "" } },
        upsert: true,
      },
    }))
  );
  return {
    ok: true,
    fixture_group: ENTERPRISE_FIXTURE_GROUP,
    source_records_loaded: records.length,
    source_systems: summarizeBy(records, "source_system"),
    dashboard: await getIngestionDashboard(),
  };
}

export async function clearEnterpriseFixtures() {
  const records = await SourceRecord.find({ fixture_group: ENTERPRISE_FIXTURE_GROUP }).select("key").lean();
  const keys = records.map((record) => record.key);
  const [events, relationships, sourceRecords] = await Promise.all([
    Event.deleteMany({ $or: [{ fixture_group: ENTERPRISE_FIXTURE_GROUP }, { source_record_id: { $in: keys } }] }),
    Relationship.deleteMany({ fixture_group: ENTERPRISE_FIXTURE_GROUP }),
    SourceRecord.deleteMany({ fixture_group: ENTERPRISE_FIXTURE_GROUP }),
  ]);
  return {
    ok: true,
    fixture_group: ENTERPRISE_FIXTURE_GROUP,
    deleted_source_records: sourceRecords.deletedCount || 0,
    deleted_relationships: relationships.deletedCount || 0,
    deleted_events: events.deletedCount || 0,
    dashboard: await getIngestionDashboard(),
  };
}

export async function runIngestion() {
  const records = await SourceRecord.find().lean();
  const now = new Date();
  const ingestion_run_id = `ingestion-run-${now.toISOString()}`;
  let relationship_upserts = 0;
  let event_upserts = 0;
  let ignored = 0;

  const relationshipOps = records
    .filter((record) => record.record_type === "relationship" && record.payload?.relationship)
    .map((record) => {
      relationship_upserts += 1;
      const { key, ...rel } = record.payload.relationship;
      return {
        updateOne: {
          filter: { key },
          update: {
            $set: {
              ...rel,
              evidence: [...(rel.evidence || []), ...(record.evidence || [])],
              source_system: record.source_system,
              source_record_id: record.key,
              fixture_group: record.fixture_group,
              provenance: buildProvenance(record, ingestion_run_id),
              evidence_source_records: [record.key],
              last_seen_at: record.observed_at || now,
            },
            $setOnInsert: { key, first_seen_at: record.observed_at || now },
          },
          upsert: true,
        },
      };
    });

  if (relationshipOps.length) await Relationship.bulkWrite(relationshipOps);

  for (const record of records) {
    if (record.record_type !== "alert") continue;
    event_upserts += 1;
    await Event.updateOne(
      { source_record_id: record.key },
      {
        $set: {
          interface_key: record.entity_key,
          timestamp: record.observed_at || now,
          status: record.payload?.status || "degraded",
          message_type: record.payload?.message_type,
          reason: record.payload?.reason || "Imported observability alert",
          detail: record.payload?.detail,
          severity: record.payload?.severity || "warning",
          source_system: record.source_system,
          source_record_id: record.key,
          fixture_group: record.fixture_group,
          provenance: buildProvenance(record, ingestion_run_id),
        },
      },
      { upsert: true }
    );
  }

  ignored = records.length - relationship_upserts - event_upserts;
  await SourceRecord.updateMany({}, { $set: { ingestion_status: "ingested", ingested_at: now, ingestion_run_id } });
  return {
    ok: true,
    ingestion_run_id,
    source_records: records.length,
    relationship_upserts,
    event_upserts,
    ignored,
    quality: await getDataQuality(),
  };
}

export async function getDataQuality() {
  const [records, relationships, interfaces] = await Promise.all([
    SourceRecord.find().lean(),
    Relationship.find().lean(),
    Interface.find().lean(),
  ]);
  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 3600 * 1000);
  const processMapped = new Set(
    relationships
      .filter((r) => r.from_type === "interface" && r.relationship_type === "supports_process")
      .map((r) => r.from_key)
  );
  const stale_records = records.filter((r) => r.observed_at && r.observed_at < cutoff);
  const inferred_relationships = relationships.filter((r) => !r.confirmed);
  const missing_owners = interfaces.filter((i) => !(i.owners || []).length);
  const missing_process_mappings = interfaces.filter(
    (i) => i.lifecycle === "production" && !processMapped.has(i.key)
  );
  const unresolved_aliases = records.filter((r) => r.entity_resolution?.status === "unresolved");
  const provenance_missing = records.filter((r) => !r.provenance?.source_id);
  const ownership_conflicts = buildOwnershipConflicts(records, interfaces);
  const scorecard = buildScorecard({
    records,
    stale_records,
    inferred_relationships,
    missing_owners,
    missing_process_mappings,
    unresolved_aliases,
    ownership_conflicts,
    provenance_missing,
  });

  return {
    source_record_count: records.length,
    relationship_count: relationships.length,
    confirmed_relationships: relationships.filter((r) => r.confirmed).length,
    pending_records: records.filter((r) => r.ingestion_status === "pending").length,
    records_by_type: summarizeBy(records, "record_type"),
    fixture_records: records.filter((r) => r.fixture_group === ENTERPRISE_FIXTURE_GROUP).length,
    provenance_coverage: records.length ? Math.round(((records.length - provenance_missing.length) / records.length) * 100) : 100,
    scorecard,
    inferred_relationships: lightRelationships(inferred_relationships),
    stale_records: lightRecords(stale_records),
    unresolved_aliases: lightRecords(unresolved_aliases),
    ownership_conflicts,
    missing_owners: missing_owners.map((i) => ({ key: i.key, name: i.name })),
    missing_process_mappings: missing_process_mappings.map((i) => ({ key: i.key, name: i.name })),
    source_systems: summarizeBy(records, "source_system"),
    findings: buildFindings(stale_records, inferred_relationships, missing_owners, missing_process_mappings, unresolved_aliases, ownership_conflicts, provenance_missing),
  };
}

function summarizeSourceRecords(records) {
  return {
    total: records.length,
    by_source: summarizeBy(records, "source_system"),
    by_type: summarizeBy(records, "record_type"),
    by_status: summarizeBy(records, "ingestion_status"),
    fixture_records: records.filter((r) => r.fixture_group === ENTERPRISE_FIXTURE_GROUP).length,
  };
}

function summarizeBy(items, field) {
  return items.reduce((acc, item) => {
    const key = item[field] || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function lightRecords(records) {
  return records.map((r) => ({
    key: r.key,
    source_system: r.source_system,
    external_id: r.external_id,
    observed_at: r.observed_at,
    alias: r.entity_resolution?.alias,
    canonical_key: r.entity_resolution?.canonical_key,
  }));
}

function lightRelationships(relationships) {
  return relationships.map((r) => ({
    key: r.key,
    relationship_type: r.relationship_type,
    confidence: r.confidence,
    from_key: r.from_key,
    to_key: r.to_key,
  }));
}

function buildFindings(stale, inferred, missingOwners, missingProcessMappings, unresolvedAliases, ownershipConflicts, provenanceMissing) {
  return [
    { label: "Stale source records", count: stale.length, severity: stale.length ? "warning" : "ok" },
    { label: "Inferred relationships", count: inferred.length, severity: inferred.length ? "warning" : "ok" },
    { label: "Interfaces missing owners", count: missingOwners.length, severity: missingOwners.length ? "critical" : "ok" },
    {
      label: "Production interfaces missing process mapping",
      count: missingProcessMappings.length,
      severity: missingProcessMappings.length ? "warning" : "ok",
    },
    { label: "Unresolved source aliases", count: unresolvedAliases.length, severity: unresolvedAliases.length ? "critical" : "ok" },
    { label: "Ownership conflicts", count: ownershipConflicts.length, severity: ownershipConflicts.length ? "warning" : "ok" },
    { label: "Records missing provenance", count: provenanceMissing.length, severity: provenanceMissing.length ? "warning" : "ok" },
  ];
}

function buildPipeline(records, quality) {
  const relationships = quality.records_by_type?.relationship || 0;
  const alerts = quality.records_by_type?.alert || 0;
  return [
    { label: "Capture raw records", value: records.length, detail: "Stored unchanged in source_records" },
    { label: "Resolve aliases", value: records.length - (quality.unresolved_aliases?.length || 0), detail: "External names mapped to canonical keys" },
    { label: "Normalize context", value: relationships + alerts, detail: "Relationships and events upserted" },
    { label: "Quality gate", value: quality.findings.filter((f) => f.severity !== "ok").length, detail: "Findings that require stewardship" },
  ];
}

function buildProvenance(record, ingestion_run_id) {
  return {
    ...(record.provenance || {}),
    source_record_key: record.key,
    ingestion_run_id,
    observed_at: record.observed_at,
    captured_at: record.provenance?.captured_at,
  };
}

function buildOwnershipConflicts(records, interfaces) {
  const interfacesByKey = Object.fromEntries(interfaces.map((i) => [i.key, i]));
  return records
    .filter((record) => record.entity_type === "interface" && record.payload?.owner_key)
    .filter((record) => {
      const iface = interfacesByKey[record.entity_key];
      return iface && !(iface.owners || []).includes(record.payload.owner_key);
    })
    .map((record) => ({
      source_record: record.key,
      interface_key: record.entity_key,
      source_owner: record.payload.owner_key,
      canonical_owners: interfacesByKey[record.entity_key]?.owners || [],
    }));
}

function buildScorecard({ records, stale_records, inferred_relationships, missing_owners, missing_process_mappings, unresolved_aliases, ownership_conflicts, provenance_missing }) {
  const penalty =
    Math.min(stale_records.length, 5) * 5 +
    Math.min(inferred_relationships.length, 8) * 3 +
    missing_owners.length * 15 +
    Math.min(missing_process_mappings.length, 5) * 4 +
    unresolved_aliases.length * 12 +
    ownership_conflicts.length * 8 +
    provenance_missing.length * 2;
  return {
    trust_score: Math.max(0, 100 - penalty),
    provenance_coverage: records.length ? Math.round(((records.length - provenance_missing.length) / records.length) * 100) : 100,
    pending_records: records.filter((r) => r.ingestion_status === "pending").length,
    stewardship_items: stale_records.length + unresolved_aliases.length + ownership_conflicts.length + missing_owners.length + missing_process_mappings.length,
  };
}