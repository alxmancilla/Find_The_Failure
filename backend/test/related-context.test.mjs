// Related-context retrieval fallback order, with a stubbed aggregate (no database).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runRetrievalAttempts } from "../src/services/relatedContext.js";

const attempts = [
  { engine: "auto-embed-vector-rerank", pipeline: ["vector"] },
  { engine: "atlas-search-rerank", pipeline: ["rerank"] },
  { engine: "atlas-search", pipeline: ["search"] },
];
const stub = (results) => async (pipeline) => {
  const r = results[pipeline[0]];
  if (r instanceof Error) throw r;
  return r;
};

describe("related-context retrieval", () => {
  it("[local-demo-startup:REQ-001] falls through when vector search returns no documents", async () => {
    const hit = await runRetrievalAttempts(attempts, stub({ vector: [], rerank: [{ key: "k1" }], search: [{ key: "k2" }] }));
    assert.equal(hit.attempt.engine, "atlas-search-rerank");
    assert.deepEqual(hit.documents, [{ key: "k1" }]);
  });

  it("[local-demo-startup:REQ-001] keeps vector results when there are any", async () => {
    const hit = await runRetrievalAttempts(attempts, stub({ vector: [{ key: "v1" }], rerank: [], search: [] }));
    assert.equal(hit.attempt.engine, "auto-embed-vector-rerank");
  });

  it("[local-demo-startup:REQ-001] reports the engine that answered after errors and empty results", async () => {
    const hit = await runRetrievalAttempts(attempts, stub({ vector: [], rerank: new Error("rerank unavailable"), search: [{ key: "s1" }] }));
    assert.equal(hit.attempt.engine, "atlas-search");
  });

  it("returns an empty Atlas Search result as-is (not a vector attempt)", async () => {
    const hit = await runRetrievalAttempts([attempts[2]], stub({ search: [] }));
    assert.equal(hit.attempt.engine, "atlas-search");
    assert.deepEqual(hit.documents, []);
  });

  it("returns null when every attempt errors", async () => {
    const boom = new Error("down");
    assert.equal(await runRetrievalAttempts(attempts, stub({ vector: boom, rerank: boom, search: boom })), null);
  });
});
