// Search-index startup retries and auto-embedding readiness, with stubs (no database).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createWithRetry, waitForAutoEmbedding } from "../src/services/searchIndex.js";

const TRANSIENT = new Error("Error connecting to Search Index Management service.");
const sequence = (outcomes) => {
  let calls = 0;
  const fn = async () => {
    const o = outcomes[Math.min(calls++, outcomes.length - 1)];
    if (o instanceof Error) throw o;
    return o;
  };
  fn.calls = () => calls;
  return fn;
};
const fast = { intervalMs: 5, logIntervalMs: 0 };

describe("search index startup", () => {
  it("[local-demo-startup:REQ-002] retries transient errors until the index is created", async () => {
    const create = sequence([TRANSIENT, TRANSIENT, "ok"]);
    const result = await createWithRetry(create, { deadline: Date.now() + 5000, label: "interfaces", ...fast });
    assert.equal(result, "created");
    assert.equal(create.calls(), 3);
  });

  it("[local-demo-startup:REQ-002] treats an existing index as done and does not retry other errors", async () => {
    assert.equal(await createWithRetry(sequence([new Error("Index already exists")]), { deadline: Date.now() + 5000, label: "x", ...fast }), "exists");
    const other = sequence([new Error("not authorized")]);
    assert.equal(await createWithRetry(other, { deadline: Date.now() + 5000, label: "x", ...fast }), "failed");
    assert.equal(other.calls(), 1);
  });

  it("[local-demo-startup:REQ-002,REQ-004] gives up at the deadline instead of blocking startup", async () => {
    const start = Date.now();
    const result = await createWithRetry(sequence([TRANSIENT]), { deadline: Date.now() + 60, label: "x", ...fast });
    assert.equal(result, "timeout");
    assert.ok(Date.now() - start < 1000);
  });

  it("[local-demo-startup:REQ-003] waits until the auto-embedding probe returns documents", async () => {
    const probe = sequence([0, 0, 8]);
    assert.equal(await waitForAutoEmbedding(probe, { timeoutMs: 5000, intervalMs: 5 }), true);
    assert.equal(probe.calls(), 3);
  });

  it("[local-demo-startup:REQ-003,REQ-004] returns false on timeout, including when the probe errors", async () => {
    const start = Date.now();
    assert.equal(await waitForAutoEmbedding(sequence([new Error("not ready"), 0]), { timeoutMs: 60, intervalMs: 5 }), false);
    assert.ok(Date.now() - start < 1000);
  });
});
