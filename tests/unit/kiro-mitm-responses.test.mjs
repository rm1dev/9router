import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const previousKey = process.env.ROUTER_API_KEY;
process.env.ROUTER_API_KEY = "local-router-test-key";
const { intercept } = require("../../src/mitm/handlers/kiro.js");
if (previousKey === undefined) delete process.env.ROUTER_API_KEY;
else process.env.ROUTER_API_KEY = previousKey;
const { isChatRequest, extractModel } = require("../../src/mitm/config.js");

function responseCapture() {
  return {
    chunks: [],
    writeHead(status, headers) { this.status = status; this.headers = headers; this.headersSent = true; },
    write(chunk) { this.chunks.push(Buffer.from(chunk)); },
    end(chunk) { if (chunk) this.write(chunk); this.ended = true; },
  };
}

describe("Kiro main-agent CreateResponse transport", () => {
  it("intercepts POST /v1/responses and extracts the Qwen model", () => {
    const req = { method: "POST", url: "/v1/responses", headers: {} };
    assert.equal(isChatRequest("kiro", req), true);
    assert.equal(extractModel(req.url, Buffer.from('{"model":"qwen3-coder-next","input":[]}')), "qwen3-coder-next");
    assert.equal(isChatRequest("kiro", { ...req, url: "/v1/responses/?request=1" }), true);
  });

  it("keeps auxiliary tasks on their original transport and other requests on passthrough", () => {
    assert.equal(isChatRequest("kiro", { method: "POST", url: "/", headers: { "x-amz-target": "KiroRuntimeService.GenerateAssistantResponse" } }), true);
    for (const req of [
      { method: "GET", url: "/v1/responses", headers: {} },
      { method: "POST", url: "/v1/responses/response_123", headers: {} },
      { method: "POST", url: "/", headers: { "x-amz-target": "KiroRuntimeService.InvokeMCP" } },
    ]) assert.equal(isChatRequest("kiro", req), false);
  });

  it("forwards mapped model, tools, tool outputs, reasoning, and Responses SSE without EventStream conversion", async t => {
    const body = {
      model: "qwen3-coder-next", stream: true,
      input: [
        { role: "user", content: [{ type: "input_text", text: "hi" }] },
        { type: "function_call", call_id: "call_123", name: "read_file", arguments: "{}" },
        { type: "function_call_output", call_id: "call_123", output: "file content" },
      ],
      tools: [{ type: "function", name: "read_file", parameters: { type: "object" } }],
      reasoning: { effort: "low" }, include: ["reasoning.encrypted_content"],
      metadata: { conversationId: "session_123" },
    };
    const sse = 'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hello"}\n\nevent: response.completed\ndata: {"type":"response.completed","response":{"status":"completed"}}\n\n';
    const fetchMock = mock.method(globalThis, "fetch", async (url, options) => {
      assert.ok(url.endsWith("/v1/responses"));
      assert.deepEqual(JSON.parse(options.body), { ...body, model: "ag/gemini-3.8-flash" });
      assert.equal(options.headers.Authorization, "Bearer local-router-test-key");
      assert.ok(!JSON.stringify(options).includes("kiro-secret"));
      assert.ok(!("host" in options.headers));
      assert.ok(!("content-length" in options.headers));
      return new Response(sse, { headers: { "content-type": "text/event-stream" } });
    });
    t.after(() => fetchMock.mock.restore());
    const res = responseCapture();
    await intercept({ method: "POST", url: "/v1/responses", headers: {
      host: "runtime.us-east-1.kiro.dev", "content-length": "123", authorization: "Bearer kiro-secret",
    } }, res, Buffer.from(JSON.stringify(body)), "ag/gemini-3.8-flash");
    assert.equal(fetchMock.mock.callCount(), 1);
    assert.equal(res.status, 200);
    assert.equal(res.headers["Content-Type"], "text/event-stream");
    assert.equal(Buffer.concat(res.chunks).toString(), sse);
    assert.equal(res.ended, true);
  });

  it("preserves router errors on the Responses path", async t => {
    const error = '{"error":{"message":"Provider unavailable"}}';
    const fetchMock = mock.method(globalThis, "fetch", async () => new Response(error, {
      status: 503, headers: { "content-type": "application/json" },
    }));
    t.after(() => fetchMock.mock.restore());
    const res = responseCapture();
    await intercept({ method: "POST", url: "/v1/responses", headers: {} }, res,
      Buffer.from('{"model":"qwen3-coder-next","input":"hi","stream":true}'), "ag/gemini-3.8-flash");
    assert.equal(res.status, 503);
    assert.equal(Buffer.concat(res.chunks).toString(), error);
  });
});
