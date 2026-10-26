import { Router } from "express";
import { Interface, System, Owner, DataEntity, Event } from "./models.js";
import { buildFlow } from "./services/graph.js";
import {
  getImpact,
  simulateFailure,
  resetStatuses,
  getModernizationImpact,
} from "./services/impact.js";
import { search } from "./services/search.js";
import { traceInterfaceRelationships } from "./services/relationships.js";
import {
  clearEnterpriseFixtures,
  getDataQuality,
  getIngestionDashboard,
  loadEnterpriseFixtures,
  runIngestion,
} from "./services/ingestion.js";
import {
  answerCaseFollowUp,
  clearWorkbenchDemoState,
  createInvestigationCase,
  getInvestigationCase,
  ingestDemoAlerts,
  investigateAlert,
  listAlerts,
  listInvestigationCases,
  recordApprovalDecision,
  recordCaseOutcome,
  updateAlertLifecycle,
} from "./services/correlation.js";
import { getLineageFlow, listLineageEntities, listLineageFlows, traceLineage } from "./services/lineage.js";
import { clearLineageReviews, listLineageReviews, reviewLineageEdge } from "./services/lineageReview.js";
import { listFlowTransactions, traceFlowTransaction } from "./services/lineageTrace.js";
import { exportFlowOpenLineage, getLineageMetamodel } from "./services/lineageStandards.js";
import { scenarios, getScenario } from "./scenarios.js";

const router = Router();

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Search across systems, interfaces, and owners.
router.get(
  "/search",
  wrap(async (req, res) => res.json(await search(req.query.q)))
);

// List all interfaces (for pickers / overview).
router.get(
  "/interfaces",
  wrap(async (_req, res) => res.json(await Interface.find().lean()))
);

// Full detail for one interface: metadata + resolved owners, systems, entities.
router.get(
  "/interfaces/:key",
  wrap(async (req, res) => {
    const iface = await Interface.findOne({ key: req.params.key }).lean();
    if (!iface) return res.status(404).json({ error: "interface not found" });

    const [source, target, owners, dataEntities, events, middleware] =
      await Promise.all([
        System.findOne({ key: iface.source }).lean(),
        System.findOne({ key: iface.target }).lean(),
        Owner.find({ key: { $in: iface.owners || [] } }).lean(),
        DataEntity.find({ key: { $in: iface.data_entities || [] } }).lean(),
        Event.find({ interface_key: iface.key })
          .sort({ timestamp: -1 })
          .limit(5)
          .lean(),
        System.find({ key: { $in: iface.middleware || [] } }).lean(),
      ]);

    res.json({ ...iface, source, target, owners, dataEntities, events, middleware });
  })
);

// Dependency flow (nodes + edges) starting from an interface.
router.get(
  "/flow/:key",
  wrap(async (req, res) => {
    const flow = await buildFlow(req.params.key);
    if (!flow) return res.status(404).json({ error: "interface not found" });
    res.json(flow);
  })
);

// Impact analysis for an interface (downstream systems, owners, similar).
router.get(
  "/impact/:key",
  wrap(async (req, res) => {
    const impact = await getImpact(req.params.key);
    if (!impact) return res.status(404).json({ error: "interface not found" });
    res.json(impact);
  })
);

// Typed relationship trace over the canonical relationships collection.
router.get(
  "/relationships/trace/:key",
  wrap(async (req, res) => {
    const iface = await Interface.findOne({ key: req.params.key }).lean();
    if (!iface) return res.status(404).json({ error: "interface not found" });
    res.json(await traceInterfaceRelationships(req.params.key, req.query.direction));
  })
);

// Operational lineage: flows are data documents; entities and edges are scoped by flow.
router.get(
  "/lineage/flows",
  wrap(async (_req, res) => res.json(await listLineageFlows()))
);
router.get(
  "/lineage/flows/:flowKey",
  wrap(async (req, res) => {
    const result = await getLineageFlow(req.params.flowKey);
    if (!result) return res.status(404).json({ error: "lineage flow not found" });
    res.json(result);
  })
);
router.get(
  "/lineage/flows/:flowKey/transactions",
  wrap(async (req, res) => {
    const result = await listFlowTransactions(req.params.flowKey);
    if (!result) return res.status(404).json({ error: "lineage flow not found" });
    res.json(result);
  })
);
router.get(
  "/lineage/flows/:flowKey/transactions/:value",
  wrap(async (req, res) => {
    const result = await traceFlowTransaction(req.params.flowKey, req.params.value);
    if (!result) return res.status(404).json({ error: "lineage flow not found" });
    res.json(result);
  })
);
router.get(
  "/lineage/flows/:flowKey/openlineage",
  wrap(async (req, res) => {
    const result = await exportFlowOpenLineage(req.params.flowKey);
    if (!result) return res.status(404).json({ error: "lineage flow not found" });
    res.json(result);
  })
);
router.get(
  "/lineage/metamodel",
  wrap(async (_req, res) => res.json(getLineageMetamodel()))
);
router.get(
  "/lineage/reviews",
  wrap(async (_req, res) => res.json(await listLineageReviews()))
);
router.post(
  "/lineage/reviews/clear",
  wrap(async (_req, res) => res.json(await clearLineageReviews()))
);
router.post(
  "/lineage/edges/:edgeKey/review",
  wrap(async (req, res) => {
    const result = await reviewLineageEdge(req.params.edgeKey, req.body || {});
    if (!result) return res.status(404).json({ error: "lineage edge not found" });
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  })
);
router.get(
  "/lineage/entities",
  wrap(async (req, res) => {
    const result = await listLineageEntities(req.query.flow || undefined);
    if (!result) return res.status(404).json({ error: "lineage flow not found" });
    res.json(result);
  })
);
router.get(
  "/lineage/:entityKey",
  wrap(async (req, res) => {
    const direction = ["upstream", "downstream", "both"].includes(req.query.direction) ? req.query.direction : "both";
    const asOf = req.query.as_of && !Number.isNaN(Date.parse(req.query.as_of)) ? req.query.as_of : null;
    const result = await traceLineage(req.params.entityKey, direction, req.query.flow || undefined, asOf);
    if (!result) return res.status(404).json({ error: "lineage entity not found" });
    res.json(result);
  })
);

// Simulate a failure on an interface.
router.post(
  "/simulate/:key",
  wrap(async (req, res) => {
    const { reason, detail } = req.body || {};
    const result = await simulateFailure(req.params.key, reason, detail);
    if (!result) return res.status(404).json({ error: "interface not found" });
    res.json(result);
  })
);

// Reset all interfaces to healthy.
router.post(
  "/reset",
  wrap(async (_req, res) => res.json(await resetStatuses()))
);

// List the pre-scripted demo scenarios.
router.get(
  "/scenarios",
  wrap(async (_req, res) => res.json(scenarios))
);

// Run a named scenario: build the dependency flow and inject its failure.
router.post(
  "/scenarios/:id/run",
  wrap(async (req, res) => {
    const scenario = getScenario(req.params.id);
    if (!scenario) return res.status(404).json({ error: "scenario not found" });
    const flow = await buildFlow(scenario.flow_start);
    const impact = await simulateFailure(
      scenario.interface_key,
      scenario.reason,
      scenario.detail
    );
    res.json({ scenario, flow, impact });
  })
);

// Modernization: impact of replacing/changing a system.
router.get(
  "/modernization/:systemKey",
  wrap(async (req, res) =>
    res.json(await getModernizationImpact(req.params.systemKey))
  )
);

// Federated metadata ingestion demo: raw source records, normalization, quality.
router.get(
  "/ingestion",
  wrap(async (_req, res) => res.json(await getIngestionDashboard()))
);
router.post(
  "/ingestion/run",
  wrap(async (_req, res) => res.json(await runIngestion()))
);
router.post(
  "/ingestion/fixtures",
  wrap(async (_req, res) => res.json(await loadEnterpriseFixtures()))
);
router.post(
  "/ingestion/fixtures/clear",
  wrap(async (_req, res) => res.json(await clearEnterpriseFixtures()))
);
router.get(
  "/ingestion/quality",
  wrap(async (_req, res) => res.json(await getDataQuality()))
);

// Read-only investigation: correlate an observability alert to topology/impact.
router.get(
  "/alerts",
  wrap(async (_req, res) => res.json(await listAlerts()))
);
router.post(
  "/alerts/demo-feed",
  wrap(async (_req, res) => res.json(await ingestDemoAlerts()))
);
router.post(
  "/alerts/:sourceRecordKey/lifecycle",
  wrap(async (req, res) => {
    const result = await updateAlertLifecycle(req.params.sourceRecordKey, req.body?.status);
    if (!result) return res.status(404).json({ error: "alert not found" });
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  })
);
router.post(
  "/workbench/clear-demo-state",
  wrap(async (_req, res) => res.json(await clearWorkbenchDemoState()))
);
router.get(
  "/investigation/:sourceRecordKey",
  wrap(async (req, res) => {
    const result = await investigateAlert(req.params.sourceRecordKey);
    if (!result) return res.status(404).json({ error: "alert not found" });
    res.json(result);
  })
);

// Agent case memory: persisted, auditable investigation state.
router.get(
  "/cases",
  wrap(async (_req, res) => res.json(await listInvestigationCases()))
);
router.post(
  "/cases/investigate/:sourceRecordKey",
  wrap(async (req, res) => {
    const result = await createInvestigationCase(req.params.sourceRecordKey);
    if (!result) return res.status(404).json({ error: "alert not found" });
    if (result.investigation?.error) return res.status(404).json(result.investigation);
    res.json(result);
  })
);
router.get(
  "/cases/:caseKey",
  wrap(async (req, res) => {
    const result = await getInvestigationCase(req.params.caseKey);
    if (!result) return res.status(404).json({ error: "case not found" });
    res.json({ case: result });
  })
);
router.post(
  "/cases/:caseKey/messages",
  wrap(async (req, res) => {
    const { question } = req.body || {};
    if (!question) return res.status(400).json({ error: "question is required" });
    const result = await answerCaseFollowUp(req.params.caseKey, question);
    if (!result) return res.status(404).json({ error: "case not found" });
    res.json(result);
  })
);
router.post(
  "/cases/:caseKey/approval-decision",
  wrap(async (req, res) => {
    const result = await recordApprovalDecision(req.params.caseKey, req.body || {});
    if (!result) return res.status(404).json({ error: "case not found" });
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  })
);
router.post(
  "/cases/:caseKey/outcome",
  wrap(async (req, res) => {
    const result = await recordCaseOutcome(req.params.caseKey, req.body || {});
    if (!result) return res.status(404).json({ error: "case not found" });
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  })
);

// Systems and owners listings (used by modernization picker).
router.get(
  "/systems",
  wrap(async (_req, res) => res.json(await System.find().lean()))
);
router.get(
  "/owners",
  wrap(async (_req, res) => res.json(await Owner.find().lean()))
);

export default router;
