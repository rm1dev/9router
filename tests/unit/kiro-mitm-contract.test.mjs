import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { pipeTransformedEventStream } = require("../../src/mitm/handlers/base.js");
const { convertOpenAIToKiro, initKiroState } = require("../../src/mitm/handlers/kiro.js");

function decode(bytes) {
  const events = [];
  for (let p = 0; p < bytes.length;) {
    const total = bytes.readUInt32BE(p);
    const end = p + 12 + bytes.readUInt32BE(p + 4);
    assert.ok(total >= 16 && p + total <= bytes.length);
    const headers = {};
    for (let q = p + 12; q < end;) {
      const len = bytes[q++];
      const name = bytes.subarray(q, q + len).toString();
      q += len;
      assert.equal(bytes[q++], 7);
      const valueLen = bytes.readUInt16BE(q);
      q += 2;
      headers[name] = bytes.subarray(q, q + valueLen).toString();
      q += valueLen;
    }
    events.push({ headers, payload: JSON.parse(bytes.subarray(end, p + total - 4)) });
    p += total;
  }
  return events;
}

async function run(chunks, options = {}) {
  const sse = chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join("") + (options.noNewline ? "" : "data: [DONE]\n\n");
  const response = options.response || new Response(sse, { headers: { "content-type": "text/event-stream" } });
  const res = {
    chunks: [],
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    write(chunk) { this.chunks.push(Buffer.from(chunk)); },
    end(chunk) { if (chunk) this.write(chunk); this.ended = true; },
  };
  const state = initKiroState("auto", "session_123");
  await pipeTransformedEventStream(response, res, convertOpenAIToKiro, state, {
    "x-amzn-kiro-conversation-id": state.conversationId,
  });
  return { res, events: decode(Buffer.concat(res.chunks)) };
}

const choice = (delta, finish_reason = null) => ({ choices: [{ delta, finish_reason }] });
const ofType = (events, type) => events.filter(e => e.headers[":event-type"] === type);
const exceptions = events => events.filter(e => e.headers[":message-type"] === "exception");

describe("Kiro 1.2.56 MITM response contract", () => {
  for (const [reason, expected] of [["stop", "END_TURN"], ["length", "MAX_TOKENS"], ["content_filter", "CONTENT_FILTERED"]]) {
    it(`preserves ${reason} as ${expected}`, async () => {
      const { events, res } = await run([choice({ content: "Hello" }, reason)]);
      assert.equal(ofType(events, "metadataEvent")[0].payload.stopReason, expected);
      assert.equal(exceptions(events).length, 0);
      assert.equal(res.headers["x-amzn-kiro-conversation-id"], "session_123");
      assert.equal(ofType(events, "initial-response")[0].payload.conversationId, "session_123");
    });
  }

  it("collects usage arriving after finish_reason before sealing metadata", async () => {
    const { events } = await run([choice({ content: "Hello" }, "stop"), {
      choices: [], usage: { prompt_tokens: 123, completion_tokens: 7 },
    }]);
    assert.equal(ofType(events, "metadataEvent")[0].payload.tokenUsage.totalTokens, 130);
    assert.equal(ofType(events, "metadataEvent").length, 1);
  });

  it("joins split tool identity and routes interleaved argument fragments by ID", async () => {
    const tc = (index, properties) => choice({ tool_calls: [{ index, ...properties }] });
    const { events } = await run([
      tc(0, { id: "call_a", function: { arguments: '{"path":' } }),
      tc(1, { id: "call_b", function: { name: "list_directory", arguments: '{"path":' } }),
      tc(0, { function: { name: "read_file", arguments: '"/tmp/a"}' } }),
      tc(1, { function: { arguments: '"/tmp/b"}' } }),
      choice({}, "tool_calls"),
    ]);
    const tools = ofType(events, "toolUseEvent").map(e => e.payload);
    assert.ok(tools.every(t => t.toolUseId));
    for (const [id, name, path] of [["call_a", "read_file", "/tmp/a"], ["call_b", "list_directory", "/tmp/b"]]) {
      const call = tools.filter(t => t.toolUseId === id);
      assert.equal(call[0].name, name);
      assert.deepEqual(JSON.parse(call.map(t => t.input || "").join("")), { path });
      assert.equal(call.at(-1).stop, true);
    }
    assert.equal(ofType(events, "metadataEvent")[0].payload.stopReason, "TOOL_USE");
  });

  it("rejects a tool call missing its ID without sending TOOL_USE success", async () => {
    const { events } = await run([choice({ tool_calls: [{ index: 0, function: { name: "read_file", arguments: "{}" } }] }, "tool_calls")]);
    assert.equal(exceptions(events).length, 1);
    assert.equal(ofType(events, "metadataEvent").length, 0);
  });

  it("preserves a trailing literal tag prefix", async () => {
    const { events } = await run([choice({ content: "Use <" }, "stop")]);
    assert.equal(ofType(events, "assistantResponseEvent").map(e => e.payload.content).join(""), "Use <");
  });

  it("encodes an SSE error as a Kiro exception without success metadata", async () => {
    const { events } = await run([choice({ content: "Partial" }), { error: { message: "Upstream unavailable" } }]);
    assert.equal(exceptions(events)[0].headers[":exception-type"], "InternalServerException");
    assert.equal(exceptions(events)[0].payload.message, "Upstream unavailable");
    assert.equal(ofType(events, "metadataEvent").length, 0);
  });

  it("reports truncated streams instead of inventing a successful finish", async () => {
    const { events } = await run([choice({ content: "Partial" })]);
    assert.equal(exceptions(events).length, 1);
    assert.equal(ofType(events, "metadataEvent").length, 0);
  });

  for (const reason of ["error", "tool_calls"]) {
    it(`rejects a terminal ${reason} without a valid completed response`, async () => {
      const { events } = await run([choice({}, reason)]);
      assert.equal(exceptions(events).length, 1);
      assert.equal(ofType(events, "metadataEvent").length, 0);
    });
  }

  for (const [name, body, ct] of [["malformed SSE", "data: {broken}\n\n", "text/event-stream"], ["non-SSE body", "{}", "application/json"]]) {
    it(`reports ${name} as a binary exception`, async () => {
      const { events } = await run([], { response: new Response(body, { headers: { "content-type": ct } }) });
      assert.equal(exceptions(events).length, 1);
      assert.equal(ofType(events, "metadataEvent").length, 0);
    });
  }

  it("processes a final SSE line without a newline", async () => {
    const { events } = await run([], { response: new Response(`data: ${JSON.stringify(choice({ content: "Hello" }, "stop"))}`, {
      headers: { "content-type": "text/event-stream" },
    }) });
    assert.equal(ofType(events, "assistantResponseEvent")[0].payload.content, "Hello");
    assert.equal(ofType(events, "metadataEvent")[0].payload.stopReason, "END_TURN");
  });

  it("encodes transport failures after partial output as a binary exception", async () => {
    let step = 0;
    const response = new Response(new ReadableStream({ pull(controller) {
      if (step++ === 0) controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(choice({ content: "Partial" }))}\n\n`));
      else controller.error(new Error("sensitive transport details"));
    } }), { headers: { "content-type": "text/event-stream" } });
    const { events } = await run([], { response });
    assert.equal(exceptions(events).length, 1);
    assert.equal(exceptions(events)[0].payload.message, "Router stream could not be completed");
    assert.equal(ofType(events, "metadataEvent").length, 0);
  });
});
