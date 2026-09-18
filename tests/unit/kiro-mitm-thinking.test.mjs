import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  convertOpenAIToKiro,
  initKiroState,
  buildEventStreamFrame,
  buildReasoningFrame,
  extractThinking,
  emitFinish,
} = require("../../src/mitm/handlers/kiro.js");

// Helper to decode AWS EventStream binary frames
function decodeFrames(frames) {
  if (!frames) return [];
  const list = Array.isArray(frames) ? frames : [frames];
  return list.map((f) => {
    const totalLen = f.readUInt32BE(0);
    const headersLen = f.readUInt32BE(4);
    let o = 12;
    const headers = {};
    while (o < 12 + headersLen) {
      const nLen = f[o++];
      const name = f.slice(o, o + nLen).toString("utf8");
      o += nLen;
      const type = f[o++];
      const vLen = f.readUInt16BE(o);
      o += 2;
      const val = f.slice(o, o + vLen).toString("utf8");
      o += vLen;
      headers[name] = val;
    }
    const payloadBuf = f.slice(12 + headersLen, totalLen - 4);
    let payload;
    try {
      payload = JSON.parse(payloadBuf.toString("utf8"));
    } catch {
      payload = payloadBuf.toString("utf8");
    }
    return { headers, payload };
  });
}

describe("Kiro MITM Reasoning & Thinking Handling", () => {
  it("buildReasoningFrame produces Smithy-compliant reasoningContentEvent with text and signature", () => {
    const state = initKiroState("gemini-3.8-flash");
    const frame = buildReasoningFrame("Thinking about the answer...", state);
    const decoded = decodeFrames(frame);

    assert.equal(decoded.length, 1);
    const event = decoded[0];
    assert.equal(event.headers[":event-type"], "reasoningContentEvent");
    assert.equal(event.payload.text, "Thinking about the answer...");
    assert.equal(event.payload.content, "Thinking about the answer...");
    assert.ok(typeof event.payload.signature === "string" && event.payload.signature.length > 0);
    assert.equal(event.payload.modelId, "gemini-3.8-flash");
  });

  it("convertOpenAIToKiro converts delta.reasoning_content into proper reasoningContentEvent", () => {
    const state = initKiroState("gemini-3.8-flash");

    // Chunk 1: Role delta
    const c1 = { choices: [{ delta: { role: "assistant" } }] };
    const f1 = decodeFrames(convertOpenAIToKiro(c1, state));
    assert.equal(f1.length, 1);
    assert.equal(f1[0].headers[":event-type"], "initial-response");

    // Chunk 2: reasoning_content delta
    const c2 = { choices: [{ delta: { reasoning_content: "Analyzing query constraints..." } }] };
    const f2 = decodeFrames(convertOpenAIToKiro(c2, state));
    assert.equal(f2.length, 1);
    assert.equal(f2[0].headers[":event-type"], "reasoningContentEvent");
    assert.equal(f2[0].payload.text, "Analyzing query constraints...");
    assert.ok(f2[0].payload.signature.startsWith("sig_"));

    // Chunk 3: content delta (regular response)
    const c3 = { choices: [{ delta: { content: "Here is the response." } }] };
    const f3 = decodeFrames(convertOpenAIToKiro(c3, state));
    assert.equal(f3.length, 1);
    assert.equal(f3[0].headers[":event-type"], "assistantResponseEvent");
    assert.equal(f3[0].payload.content, "Here is the response.");
  });

  it("extractThinking correctly parses <think> tags in streaming content", () => {
    const state = initKiroState("test-model");

    // Start of thinking tag
    const step1 = extractThinking("<think>Evaluating options", state);
    assert.equal(step1.thinking, "Evaluating options");
    assert.equal(step1.text, null);
    assert.equal(state.inThink, true);

    // Mid-thinking continuation
    const step2 = extractThinking(" and alternatives", state);
    assert.equal(step2.thinking, " and alternatives");
    assert.equal(step2.text, null);
    assert.equal(state.inThink, true);

    // End of thinking + response start
    const step3 = extractThinking(".</think>The final result is 42.", state);
    assert.equal(step3.thinking, ".");
    assert.equal(step3.text, "The final result is 42.");
    assert.equal(state.inThink, false);
  });

  it("emitFinish emits metadataEvent with stopReason to prevent Kiro truncation retries", () => {
    const state = initKiroState("gemini-3.8-flash");
    state.usage = { prompt_tokens: 150, completion_tokens: 75 };

    const finishFrames = decodeFrames(emitFinish(state));
    const metaEvent = finishFrames.find((f) => f.headers[":event-type"] === "metadataEvent");

    assert.ok(metaEvent, "metadataEvent must be present");
    assert.equal(metaEvent.payload.stopReason, "end_turn");
    assert.equal(metaEvent.payload.tokenUsage.uncachedInputTokens, 150);
    assert.equal(metaEvent.payload.tokenUsage.outputTokens, 75);
    assert.equal(metaEvent.payload.tokenUsage.totalTokens, 225);
  });

  it("emitFinish sets stopReason to tool_use when tool calls are present", () => {
    const state = initKiroState("gemini-3.8-flash");
    state.hasToolCalls = true;
    state.toolCallInit[0] = { id: "call_123", name: "fs_read" };

    const finishFrames = decodeFrames(emitFinish(state));
    const toolEvent = finishFrames.find((f) => f.headers[":event-type"] === "toolUseEvent");
    const metaEvent = finishFrames.find((f) => f.headers[":event-type"] === "metadataEvent");

    assert.ok(toolEvent, "toolUseEvent must be present");
    assert.equal(toolEvent.payload.stop, true);
    assert.ok(metaEvent, "metadataEvent must be present");
    assert.equal(metaEvent.payload.stopReason, "tool_use");
  });

  it("convertOpenAIToKiro flush (null chunk) terminates cleanly with metadataEvent", () => {
    const state = initKiroState("gemini-3.8-flash");
    state.inThink = true;
    state.thinkBuf = "Final unclosed thinking";

    const flushed = decodeFrames(convertOpenAIToKiro(null, state));
    const reasoningEvent = flushed.find((f) => f.headers[":event-type"] === "reasoningContentEvent");
    const metaEvent = flushed.find((f) => f.headers[":event-type"] === "metadataEvent");

    assert.ok(reasoningEvent, "Buffered thinking flushed as reasoningContentEvent");
    assert.equal(reasoningEvent.payload.text, "Final unclosed thinking");
    assert.ok(metaEvent, "Clean metadataEvent termination emitted on flush");
    assert.equal(metaEvent.payload.stopReason, "end_turn");
  });
});
