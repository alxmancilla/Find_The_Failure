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
import { scenarios, getScenario } from "./scenarios.js";

const router = Router();

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: err.message });
  });

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
