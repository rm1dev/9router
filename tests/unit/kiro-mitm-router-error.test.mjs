import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { pipeTransformedEventStream } = require("../../src/mitm/handlers/base.js");
const { convertOpenAIToKiro, initKiroState } = require("../../src/mitm/handlers/kiro.js");

function captureResponse() {
  return {
    chunks: [],
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    write(chunk) { this.chunks.push(Buffer.from(chunk)); },
    end(chunk) { if (chunk) this.write(chunk); this.ended = true; },
  };
}

describe("Kiro MITM router responses", () => {
  for (const status of [401, 403, 429, 500, 503]) {
    it(`preserves router HTTP ${status} without emitting success frames`, async () => {
      const body = JSON.stringify({ error: { message: "Router request failed" } });
      const response = new Response(body, { status, headers: { "content-type": "application/json" } });
      const res = captureResponse();
      const state = initKiroState("auto");
      await pipeTransformedEventStream(response, res, convertOpenAIToKiro, state);
      assert.equal(res.status, status);
      assert.equal(res.headers["Content-Type"], "application/json");
      assert.equal(Buffer.concat(res.chunks).toString(), body);
      assert.equal(res.ended, true);
      assert.equal(state.finishSent, false);
      assert.equal(state.initialSent, false);
    });
  }

  it("still encodes successful SSE content as EventStream", async () => {
    const response = new Response('data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n', {
      headers: { "content-type": "text/event-stream" },
    });
    const res = captureResponse();
    await pipeTransformedEventStream(response, res, convertOpenAIToKiro, initKiroState("auto"));
    assert.equal(res.status, 200);
    assert.equal(res.headers["Content-Type"], "application/vnd.amazon.eventstream");
    assert.ok(Buffer.concat(res.chunks).includes(Buffer.from('"content":"Hello"')));
    assert.equal(res.ended, true);
  });
});
