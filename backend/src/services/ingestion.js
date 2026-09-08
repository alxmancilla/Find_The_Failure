import { Event, Interface, Relationship, SourceRecord } from "../models.js";

const STALE_DAYS = 45;

export async function getIngestionDashboard() {
  const [source_records, quality] = await Promise.all([
    SourceRecord.find().sort({ source_system: 1, external_id: 1 }).lean(),
    getDataQuality(),
  ]);
  return { source_records, quality, summary: summarizeSourceRecords(source_records) };
}

export async function runIngestion() {
  const records = await SourceRecord.find().lean();
  const now = new Date();
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
        $setOnInsert: {
          interface_key: record.entity_key,
          timestamp: record.observed_at || now,
          status: record.payload?.status || "degraded",
          message_type: record.payload?.message_type,
          reason: record.payload?.reason || "Imported observability alert",
          detail: record.payload?.detail,
          severity: record.payload?.severity || "warning",
          source_system: record.source_system,
          source_record_id: record.key,
        },
      },
      { upsert: true }
    );
  }

  ignored = records.length - relationship_upserts - event_upserts;
  await SourceRecord.updateMany({}, { $set: { ingestion_status: "ingested", ingested_at: now } });
  return {
    ok: true,
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

  return {
    source_record_count: records.length,
    relationship_count: relationships.length,
    confirmed_relationships: relationships.filter((r) => r.confirmed).length,
    inferred_relationships: lightRelationships(inferred_relationships),
    stale_records: lightRecords(stale_records),
    missing_owners: missing_owners.map((i) => ({ key: i.key, name: i.name })),
    missing_process_mappings: missing_process_mappings.map((i) => ({ key: i.key, name: i.name })),
    source_systems: summarizeBy(records, "source_system"),
    findings: buildFindings(stale_records, inferred_relationships, missing_owners, missing_process_mappings),
  };
}

function summarizeSourceRecords(records) {
  return { total: records.length, by_source: summarizeBy(records, "source_system") };
}

function summarizeBy(items, field) {
  return items.reduce((acc, item) => {
    const key = item[field] || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function lightRecords(records) {
  return records.map((r) => ({ key: r.key, source_system: r.source_system, observed_at: r.observed_at }));
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

function buildFindings(stale, inferred, missingOwners, missingProcessMappings) {
  return [
    { label: "Stale source records", count: stale.length, severity: stale.length ? "warning" : "ok" },
    { label: "Inferred relationships", count: inferred.length, severity: inferred.length ? "warning" : "ok" },
    { label: "Interfaces missing owners", count: missingOwners.length, severity: missingOwners.length ? "critical" : "ok" },
    {
      label: "Production interfaces missing process mapping",
      count: missingProcessMappings.length,
      severity: missingProcessMappings.length ? "warning" : "ok",
    },
  ];
}