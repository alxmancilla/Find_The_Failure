// Pushes past each history cap through the real services, then restores state.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connectDB } from "../src/db.js";
import { InvestigationCase, Relationship, SourceRecord } from "../src/models.js";
import {
  APPROVAL_DECISIONS_LIMIT,
  CASE_MESSAGES_LIMIT,
  CASE_OUTCOMES_LIMIT,
  CASE_TIMELINE_LIMIT,
  LIFECYCLE_HISTORY_LIMIT,
  REVIEW_HISTORY_LIMIT,
} from "../src/historyLimits.js";
import { answerCaseFollowUp, recordApprovalDecision, recordCaseOutcome, updateAlertLifecycle } from "../src/services/correlation.js";
import { clearLineageReviews, reviewLineageEdge } from "../src/services/lineageReview.js";

const caseKey = `history-test-${Date.now()}`;
let alertKey;

describe("history arrays are capped", () => {
  before(async () => {
    await connectDB();
    alertKey = (await SourceRecord.findOne({ record_type: "alert" }).lean()).key;
  });
  after(async () => {
    await SourceRecord.updateOne({ key: alertKey }, { $unset: { workbench_lifecycle: "" } });
    await InvestigationCase.deleteOne({ key: caseKey });
    await clearLineageReviews();
    await mongoose.disconnect();
  });

  it("[bounded-history-arrays:REQ-002,REQ-004][alert-lifecycle:REQ-005] alert lifecycle history keeps the newest 20", async () => {
    const statuses = ["acknowledged", "investigating", "escalated", "resolved", "new"];
    const pushes = LIFECYCLE_HISTORY_LIMIT + 5;
    for (let i = 0; i < pushes; i += 1) await updateAlertLifecycle(alertKey, statuses[i % statuses.length], `tester-${i}`);
    const history = (await SourceRecord.findOne({ key: alertKey }).lean()).workbench_lifecycle.history;
    assert.equal(history.length, LIFECYCLE_HISTORY_LIMIT);
    assert.equal(history.at(-1).actor, `tester-${pushes - 1}`);
    assert.equal(history[0].actor, `tester-${pushes - LIFECYCLE_HISTORY_LIMIT}`);
    assert.ok(history.every((entry) => entry.at instanceof Date && entry.status), "entries are timestamped transitions");
  });

  it("[bounded-history-arrays:REQ-002,REQ-003] steward review history keeps the newest 20", async () => {
    const edge = await Relationship.findOne({ relationship_type: "transforms_to", confirmed: false }).lean();
    const pushes = REVIEW_HISTORY_LIMIT + 5;
    for (let i = 0; i < pushes; i += 1) {
      await reviewLineageEdge(edge.key, { decision: i % 2 ? "rejected" : "confirmed", note: `note-${i}` });
    }
    const history = (await Relationship.findOne({ key: edge.key }).lean()).review_history;
    assert.equal(history.length, REVIEW_HISTORY_LIMIT);
    assert.equal(history.at(-1).note, `note-${pushes - 1}`);
  });

  it("[bounded-history-arrays:REQ-002,REQ-005] case decisions, outcomes, messages, and timeline stay within their caps", async () => {
    await InvestigationCase.create({ key: caseKey, alert_key: alertKey, investigation_result: {}, timeline: [], messages: [] });
    const outcomes = ["resolved", "monitoring", "transferred"];
    const decisions = ["approved", "deferred", "rejected"];
    for (let i = 0; i < APPROVAL_DECISIONS_LIMIT + 5; i += 1) await recordApprovalDecision(caseKey, { decision: decisions[i % 3], note: `decision-${i}` });
    for (let i = 0; i < CASE_OUTCOMES_LIMIT + 5; i += 1) await recordCaseOutcome(caseKey, { outcome: outcomes[i % 3], note: `outcome-${i}` });
    const questions = CASE_TIMELINE_LIMIT - 40;
    for (let i = 0; i < questions; i += 1) await answerCaseFollowUp(caseKey, `What should I check first? (${i})`);

    const doc = await InvestigationCase.findOne({ key: caseKey }).lean();
    assert.equal(doc.approval_decisions.length, APPROVAL_DECISIONS_LIMIT);
    assert.equal(doc.approval_decisions.at(-1).note, `decision-${APPROVAL_DECISIONS_LIMIT + 4}`);
    assert.equal(doc.case_outcomes.length, CASE_OUTCOMES_LIMIT);
    assert.equal(doc.case_outcomes.at(-1).note, `outcome-${CASE_OUTCOMES_LIMIT + 4}`);
    assert.equal(doc.messages.length, CASE_MESSAGES_LIMIT);
    assert.equal(doc.messages.at(-2).text, `What should I check first? (${questions - 1})`);
    assert.equal(doc.timeline.length, CASE_TIMELINE_LIMIT, "approvals + outcomes + follow-ups exceed the timeline cap");
    assert.equal(doc.timeline.at(-1).event, "follow_up_answered");
  });
});
