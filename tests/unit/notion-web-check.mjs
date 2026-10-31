import assert from "node:assert/strict";
import { NotionWebExecutor, notionPrompt, notionTranscript } from "../../open-sse/executors/notion-web.js";
import { notionCookie, notionWorkspaces } from "../../open-sse/services/notionWeb.js";
import { getCapabilitiesForModel } from "../../open-sse/providers/capabilities.js";
import { getWebLoginConfig } from "../../open-sse/services/webLoginConfig.js";
import provider from "../../open-sse/providers/registry/notion-web.js";

const workspaces = notionWorkspaces({ user: { notion_user: { user: { value: { value: { id: "user", email: "test@example.com" } } } }, space: {
  free: { value: { value: { id: "free", name: "Personal", subscription_tier: "free" } } },
  paid: { value: { value: { id: "paid", name: "Team", subscription_tier: "business" } } },
  disabled: { value: { value: { id: "disabled", settings: { disable_ai_feature: true } } } },
} } });
assert.deepEqual(workspaces.map(({ spaceId, name, tier }) => ({ spaceId, name, tier })), [{ spaceId: "free", name: "Personal", tier: "free" }, { spaceId: "paid", name: "Team", tier: "business" }]);
assert.deepEqual(notionWorkspaces({}), []);
assert.equal(provider.models[0].id, "auto");
assert.equal(notionCookie("fake-token"), "token_v2=fake-token");
assert.throws(() => notionCookie("device_id=fake"), /token_v2/);
assert.equal(notionPrompt({ messages: [{ role: "user", content: "exact\n prompt" }] }), "exact\n prompt");
assert.match(notionPrompt({ messages: [{ role: "system", content: "instruction" }, { role: "user", content: "question" }] }), /instruction/);
assert.throws(() => notionPrompt({ messages: [{ role: "user", content: [{ type: "image_url" }] }] }), /attachments/);
assert.throws(() => notionPrompt({ tools: [{}], messages: [] }), /function tools/);
const tools = [{ type: "function", function: { name: "read_file", parameters: { type: "object", properties: { path: { type: "string" } } } } }];
assert.match(notionPrompt({ tools, messages: [{ role: "user", content: "Hello" }] }), /Answer text-only/);
assert.throws(() => notionPrompt({ tools, tool_choice: "required", messages: [{ role: "user", content: "Read file" }] }), /required client tools/);
const toolCalls = [{ id: "call_1", type: "function", function: { name: "read_file", arguments: '{"path":"example.txt"}' } }];
const followUp = notionPrompt({ tools, messages: [{ role: "user", content: "Summarize the file" }, { role: "assistant", content: null, tool_calls: toolCalls }, { role: "tool", content: "FILE_CONTENT", tool_call_id: "call_1" }] });
assert.match(followUp, /FILE_CONTENT/);
assert.match(followUp, /call_1/);
const entities = new Map();
const put = (id, text, sequence = 1) => ({ op: "put", entity: { id, sequence, kind: "assistant_message", content: [{ type: "text", text }] } });
assert.equal(notionTranscript([put("a", "hel")], entities).text, "hel");
assert.equal(notionTranscript([put("a", "hello"), put("a", "hello")], entities).text, "hello");
assert.equal(notionTranscript([put("b", " world", 2)], entities).text, "hello world");
assert.equal(notionTranscript([{ op: "remove", id: "b" }], entities).text, "hello");
assert.equal(notionTranscript([{ op: "put", entity: { id: "done", kind: "turn_completed", stop_reason: "end_turn" } }], entities).completed.stop_reason, "end_turn");
assert.equal(getCapabilitiesForModel("notion-web", "grok-4.7").tools, false);
assert.equal(getCapabilitiesForModel("notion-web", "grok-4.7").vision, false);
assert.ok(getWebLoginConfig("notion-web").tokenSources.some((source) => source.name === "__Host-session_binding" && !source.optional));
const invalid = await new NotionWebExecutor().execute({ model: "auto", body: { tools: [{}] }, credentials: {} });
assert.equal(invalid.response.status, 400);
console.log("Notion Web checks passed");
