import { BaseExecutor } from "./base.js";
import { notionCookie, notionRequest, resolveNotionAccount, NOTION_ORIGIN } from "../services/notionWeb.js";
import { chatChunkSse } from "../utils/sse.js";
import { SSE_DONE, SSE_HEADERS_NO_BUFFER } from "../utils/sseConstants.js";
import { setTimeout as delay } from "node:timers/promises";

export function notionPrompt(body) {
  if (body.functions?.length) throw Object.assign(new Error("Use tools instead of legacy functions with Notion Web"), { status: 400 });
  if (body.tools !== undefined && (!Array.isArray(body.tools) || body.tools.some((tool) => tool?.type !== "function" || !tool.function?.name))) throw Object.assign(new Error("Notion Web supports function tools only"), { status: 400 });
  if (!Array.isArray(body.messages) || !body.messages.length) throw Object.assign(new Error("messages must be a nonempty array"), { status: 400 });
  if (body.tool_choice && body.tool_choice !== "auto" && body.tool_choice !== "none") throw Object.assign(new Error("Notion Web cannot execute required client tools; use a tool-capable provider"), { status: 400 });
  // ponytail: optional tool declarations allow text chat only; native client-tool support is not implemented.
  const messages = body.messages.map((message) => {
    if (!["system", "developer", "user", "assistant", "tool"].includes(message.role)) throw Object.assign(new Error("Notion Web supports text conversation messages only"), { status: 400 });
    let text = message.content ?? (message.tool_calls?.length ? "" : null);
    if (Array.isArray(text)) {
      if (text.some((part) => part.type !== "text" || typeof part.text !== "string")) throw Object.assign(new Error("Notion Web does not support attachments"), { status: 400 });
      text = text.map((part) => part.text).join("\n");
    }
    if (typeof text !== "string") throw Object.assign(new Error("Message content must be text"), { status: 400 });
    return { role: message.role, content: text, ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}), ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {}) };
  });
  if (!messages.some((message) => message.role === "user" && message.content.trim())) throw Object.assign(new Error("A nonempty user message is required"), { status: 400 });
  // ponytail: stateless transcript replay; native thread reuse can replace this if history cost matters.
  const prompt = messages.length === 1 ? messages[0].content : `Continue this conversation, answering the final user message. Do not use Notion tools or workspace data.\n${JSON.stringify(messages)}`;
  return body.tools?.length ? `Client tools are unavailable on this connection. Answer text-only; do not claim to execute tools or perform actions. If tools are necessary, explain this limitation.\n${prompt}` : prompt;
}

export function notionTranscript(patches, entities) {
  for (const patch of patches || []) {
    if (patch.op === "put" && patch.entity?.id) entities.set(patch.entity.id, patch.entity);
    if (patch.op === "remove") entities.delete(patch.id);
  }
  const ordered = [...entities.values()].sort((a, b) => a.sequence - b.sequence);
  const text = ordered.filter((entity) => entity.kind === "assistant_message").flatMap((entity) => entity.content || []).filter((part) => part.type === "text").map((part) => part.text).join("");
  const completed = ordered.find((entity) => entity.kind === "turn_completed");
  const failure = ordered.find((entity) => /error|failed|tool_confirmation|permission_request/.test(entity.kind));
  return { text, completed, failure };
}

export class NotionWebExecutor extends BaseExecutor {
  constructor() { super("notion-web"); }

  async execute({ model, body, credentials, signal }) {
    const url = `${NOTION_ORIGIN}/api/v3/createAgentThread`;
    const result = (response) => ({ response, url, headers: {}, transformedBody: body });
    const controller = new AbortController();
    const requestSignal = AbortSignal.any([controller.signal, AbortSignal.timeout(180000), ...(signal ? [signal] : [])]);
    try {
      const prompt = notionPrompt(body);
      const cookie = notionCookie(credentials);
      const account = await resolveNotionAccount(cookie, { spaceId: credentials?.providerSpecificData?.spaceId, signal: requestSignal });
      const threadId = crypto.randomUUID();
      await notionRequest(cookie, "createAgentThread", {
        type: "personal_agent", spaceId: account.spaceId, threadId,
        ...(model !== "auto" ? { model } : {}),
        ...(body.reasoning_effort && body.reasoning_effort !== "auto" ? { reasoningEffort: body.reasoning_effort } : {}),
        content: [{ type: "text", text: [[prompt]] }],
        policies: { approval_mode: "ask" },
        agentMemorySettings: { useMemories: false, excludeChatFromMemories: true },
        browserEnabled: false, clientMessageId: crypto.randomUUID(),
      }, { ...account, signal: requestSignal });
      const id = `chatcmpl-${crypto.randomUUID()}`;
      const created = Math.floor(Date.now() / 1000);
      const encoder = new TextEncoder();
      // ponytail: transcript polling, not Notion's realtime socket; upgrade if sub-second latency is needed.
      return result(new Response(new ReadableStream({
        async start(output) {
          const entities = new Map();
          let cursor;
          let sent = "";
          const emit = (delta, finishReason = null) => output.enqueue(encoder.encode(chatChunkSse({ id, created, model, delta, finishReason })));
          try {
            emit({ role: "assistant", content: "" });
            while (true) {
              requestSignal.throwIfAborted();
              const page = await notionRequest(cookie, "getThreadTranscript", {
                spaceId: account.spaceId, threadId, direction: cursor ? "forward" : "backward",
                ...(cursor ? { cursor } : { limit: 100 }),
              }, { ...account, signal: requestSignal });
              const state = notionTranscript(page.patches, entities);
              if (state.failure) throw new Error("Notion stopped with an error or requires tool approval; continue in Notion.");
              if (!state.text.startsWith(sent)) throw new Error("Notion replaced previously streamed text");
              if (state.text.length > sent.length) { emit({ content: state.text.slice(sent.length) }); sent = state.text; }
              if (state.completed) {
                if (state.completed.stop_reason !== "end_turn") throw new Error(`Notion stopped: ${state.completed.stop_reason || "unknown"}`);
                emit({}, "stop");
                output.enqueue(encoder.encode(SSE_DONE));
                output.close();
                break;
              }
              cursor = page.forward_cursor || cursor;
              await delay(page.has_more_forward ? 0 : 750, undefined, { signal: requestSignal });
            }
          } catch (error) { output.error(error); }
          finally { controller.abort(); }
        },
        cancel() { controller.abort(); },
      }), { headers: SSE_HEADERS_NO_BUFFER }));
    } catch (error) {
      controller.abort();
      return result(Response.json({ error: { message: error.message, type: "notion_web_error" } }, { status: error.status >= 400 && error.status <= 599 ? error.status : 502 }));
    }
  }
}
