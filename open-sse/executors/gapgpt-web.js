// GapGptWebExecutor — GapGPT Web session provider (plain WebSocket, headless).
//
// Connects to wss://gapgpt.app/ws/salam using browser cookies (accessToken + __Host-gap_dk + csrftoken),
// dispatches `new_message` event and streams back chunks as standard OpenAI Chat Completions SSE.

import { BaseExecutor } from "./base.js";
import { SSE_DONE, SSE_HEADERS_NO_BUFFER } from "../utils/sseConstants.js";
import { sseChunk } from "../utils/sse.js";
import WebSocket from "ws";
import { randomUUID } from "node:crypto";

export const GAPGPT_WEB_BASE = "https://gapgpt.app";
export const GAPGPT_WS_URL = "wss://gapgpt.app/ws/salam";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

const MODEL_MAP = {
  "gapgpt-6": "A-GAP",
  "gpt-6-astra": "A-GPT-6-ASTRA",
  "gpt-5.6-luna": "A-GPT-5.6-LUNA",
  "gpt-5.5": "A-GPT-5.5",
  "claude-sonnet-4-5": "A-SONNET-4.5",
  "claude-3.7-sonnet": "A-SONNET3.7",
  "claude-opus-4": "A-OPUS-4",
  "deepseek-v3": "A-DEEPSEEK-V3",
  "deepseek-r1": "A-DEEPSEEK-R1",
  "gemini-2.5-pro": "A-GEMINI-2.5-PRO",
  "gemini-2.5-flash": "A-GEMINI-2.5-FLASH",
  "grok-4": "A-GROK-4",
  "grok-4-fast": "A-GROK-4-FAST",
  "grok-3": "A-GROK-3",
  // Image models
  "qwen-image": "Qwen-Image",
  "gpt-image-2": "GPT-IMAGE-2",
  "gpt-image-2.5-sunburst": "GPT-IMAGE-2.5-SUNBURST",
  "gpt-image-2.5-flare": "GPT-IMAGE-2.5-FLARE",
  "nano-banana-2.1": "Gemini-3.1-flash-image",
  "nano-banana-pro": "Gemini-3-pro-image",
  "flux-pro": "Flux-pro",
  "flux-schnell": "Flux-schnell",
  "midjourney": "Midjourney",
  "dalle-3": "DALLE-3",
};

export function resolveBotName(model) {
  if (!model) return "A-GAP";
  const stripped = String(model).trim().replace(/^(gapgpt-web|gg-web)\//i, "");
  const normalized = stripped.toLowerCase();
  if (MODEL_MAP[normalized]) return MODEL_MAP[normalized];
  if (stripped.startsWith("A-")) return stripped;
  if (stripped.toUpperCase().startsWith("A-")) return stripped.toUpperCase();
  return stripped;
}

function parseCookieString(rawCookie) {
  if (typeof rawCookie !== "string") return { cookieStr: "", csrfToken: "" };
  let str = rawCookie.trim();
  if (!str.includes("=")) {
    str = `accessToken=${str}`;
  }
  const pairs = str.split(";").map((p) => p.trim()).filter(Boolean);
  let csrf = "";
  for (const pair of pairs) {
    const [name, ...val] = pair.split("=");
    if (name.trim() === "csrftoken") {
      csrf = val.join("=").trim();
    }
  }
  return { cookieStr: str, csrfToken: csrf };
}

function extractCredentials(credentials) {
  const raw =
    credentials?.cookie ||
    credentials?.apiKey ||
    credentials?.accessToken ||
    credentials?.providerSpecificData?.cookie;

  if (typeof raw !== "string" || !raw.trim()) return null;
  return parseCookieString(raw.trim());
}

function flattenMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return "";
  const lastUser = messages.slice().reverse().find((m) => m.role === "user");
  if (messages.length <= 1 && lastUser) {
    return typeof lastUser.content === "string" ? lastUser.content : JSON.stringify(lastUser.content);
  }
  return messages
    .filter((m) => m.content)
    .map((m) => {
      const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      const role = m.role === "assistant" ? "Assistant" : m.role === "system" ? "System" : "User";
      return `${role}: ${text}`;
    })
    .join("\n\n");
}

function errorResponse(status, message) {
  return new Response(
    JSON.stringify({
      error: {
        message,
        type: "upstream_error",
        code: `HTTP_${status}`,
      },
    }),
    { status, headers: { "Content-Type": "application/json" } }
  );
}

export class GapGptWebExecutor extends BaseExecutor {
  constructor() {
    super("gapgpt-web", { baseUrl: GAPGPT_WEB_BASE });
    this.name = "gapgpt-web";
  }

  async testConnection(credentials) {
    const creds = extractCredentials(credentials);
    if (!creds?.cookieStr) return false;
    try {
      const res = await fetch(`${GAPGPT_WEB_BASE}/api/v1/profile`, {
        headers: {
          Cookie: creds.cookieStr,
          "X-Auth-Cookie": "1",
          ...(creds.csrfToken ? { "X-CSRFToken": creds.csrfToken } : {}),
          "User-Agent": DEFAULT_USER_AGENT,
        },
      });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  async execute({ model, body, stream, credentials, signal, log }) {
    const creds = extractCredentials(credentials);
    if (!creds?.cookieStr) {
      return {
        response: errorResponse(
          401,
          "Missing GapGPT Web cookies — paste your full cookie string containing accessToken and __Host-gap_dk from gapgpt.app"
        ),
        url: GAPGPT_WS_URL,
        headers: {},
        transformedBody: body,
      };
    }

    if (!creds.cookieStr.includes("__Host-gap_dk")) {
      log?.warn?.(
        "GAPGPT-WEB",
        "Cookie string lacks '__Host-gap_dk'. GapGPT requires this device key cookie for authentication."
      );
    }

    const promptText = flattenMessages(body?.messages);
    if (!promptText) {
      return {
        response: errorResponse(400, "Empty prompt or messages"),
        url: GAPGPT_WS_URL,
        headers: {},
        transformedBody: body,
      };
    }

    const botName = resolveBotName(model);
    log?.info?.("GAPGPT-WEB", `Dispatching web chat turn for model=${model} (bot_name=${botName})`);

    const clientModel = model || "gapgpt-6";
    const streamModel = clientModel;
    const id = `chatcmpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const created = Math.floor(Date.now() / 1000);

    const encoder = new TextEncoder();
    let emittedRole = false;

    const ws = new WebSocket(GAPGPT_WS_URL, {
      headers: {
        Cookie: creds.cookieStr,
        Origin: GAPGPT_WEB_BASE,
        "User-Agent": DEFAULT_USER_AGENT,
        "X-Auth-Cookie": "1",
        ...(creds.csrfToken ? { "X-CSRFToken": creds.csrfToken } : {}),
      },
    });

    if (stream !== false) {
      return new Promise((resolveOuter, rejectOuter) => {
        let streamStarted = false;
        let myMessageToken = null;
        let completed = false;
        let lastStreamedText = "";
        let lastStreamedReasoning = "";

        const readable = new ReadableStream({
          start(controller) {
            const chunk = (delta, finish) => {
              controller.enqueue(
                encoder.encode(
                  sseChunk({
                    id,
                    object: "chat.completion.chunk",
                    created,
                    model: streamModel,
                    system_fingerprint: null,
                    choices: [{ index: 0, delta, finish_reason: finish ?? null, logprobs: null }],
                  })
                )
              );
            };

            const ensureRole = () => {
              if (!emittedRole) {
                emittedRole = true;
                chunk({ role: "assistant", content: "" });
              }
            };

            const finishStream = () => {
              if (completed) return;
              completed = true;
              ensureRole();
              chunk({}, "stop");
              controller.enqueue(encoder.encode(SSE_DONE));
              try { controller.close(); } catch {}
              try { ws.close(); } catch {}
            };

            ws.on("open", () => {
              const rid = Math.floor(Math.random() * 1e8);
              const payload = {
                event: "new_message",
                rid,
                version: 98,
                data: {
                  action: {
                    type: "text_message",
                    message_token: "",
                    bot_name: botName,
                    version: 4,
                    chat_token: "",
                    text: promptText,
                    file_tokens: [],
                    allow_downgrade: false,
                    enable_user_memory: false,
                    mode: "",
                    mode_extra: {
                      model_mode: "smart",
                      model_routing_preference: "smart",
                      selected_simplified_model: botName,
                      routed_chat_model: botName,
                    },
                    chat_extra: {},
                    is_temporary: false,
                    messenger_browser_session: randomUUID(),
                  },
                  chat_token: "",
                  chat_model: botName,
                  message_token: "",
                  allow_downgrade: false,
                  enable_user_memory: false,
                },
              };
              ws.send(JSON.stringify(payload));
            });

            ws.on("message", (raw) => {
              try {
                const msg = JSON.parse(raw.toString());

                if (msg.event === "ack_new_message") {
                  if (msg.data?.status !== "ok") {
                    completed = true;
                    const errMsg =
                      msg.data?.message ||
                      `GapGPT Web authentication failed (${msg.data?.status || "unauthorized"}). Ensure cookies include both accessToken and __Host-gap_dk.`;
                    controller.error(new Error(errMsg));
                    try { ws.close(); } catch {}
                    return;
                  }
                  myMessageToken = msg.data?.message?.token;
                  return;
                }

                // Crucial: Ignore greeting/replayed messages from other chats before our message is confirmed
                if (!myMessageToken) return;

                if (msg.event === "text_response_chunk") {
                  if (msg.data?.mtoken === myMessageToken) {
                    const text = msg.data?.text;
                    if (text) {
                      ensureRole();
                      lastStreamedText += text;
                      chunk({ content: text });
                    }
                  }
                  return;
                }

                if (msg.event === "agent_turn_reasoning_chunk") {
                  if (msg.data?.mtoken === myMessageToken) {
                    const text = msg.data?.text;
                    if (text) {
                      ensureRole();
                      lastStreamedReasoning += text;
                      chunk({ reasoning_content: text });
                    }
                  }
                  return;
                }

                if (msg.event === "new_message") {
                  const m = msg.data?.message;
                  if (!m || m.token !== myMessageToken) return;

                  const responses = m.response || [];
                  for (const r of responses) {
                    if (r.type === "reasoning" && r.content) {
                      if (r.content.length > lastStreamedReasoning.length) {
                        const delta = r.content.slice(lastStreamedReasoning.length);
                        lastStreamedReasoning = r.content;
                        ensureRole();
                        chunk({ reasoning_content: delta });
                      }
                    }
                    if (r.type === "text" && r.content) {
                      if (r.content.length > lastStreamedText.length) {
                        const delta = r.content.slice(lastStreamedText.length);
                        lastStreamedText = r.content;
                        ensureRole();
                        chunk({ content: delta });
                      }
                    }
                  }

                  if (m.status === "completed") {
                    finishStream();
                  } else if (m.status === "error" || msg.data?.status === "error") {
                    completed = true;
                    controller.error(new Error(m.message || msg.data?.message || "GapGPT Web returned error"));
                    try { ws.close(); } catch {}
                  }
                }
              } catch (err) {
                log?.warn?.("GAPGPT-WEB", `Failed to parse message: ${err.message}`);
              }
            });

            ws.on("error", (err) => {
              if (!completed) {
                completed = true;
                controller.error(err);
              }
            });

            ws.on("close", (code, reason) => {
              if (!completed) {
                if (lastStreamedText.length > 0) {
                  finishStream();
                  return;
                }
                completed = true;
                const reasonStr = reason ? `: ${reason.toString()}` : "";
                controller.error(
                  new Error(
                    `GapGPT Web socket closed before completion (code ${code}${reasonStr}). Check if your cookies are valid.`
                  )
                );
                return;
              }
              finishStream();
            });

            signal?.addEventListener("abort", () => {
              completed = true;
              try { ws.close(); } catch {}
              try { controller.close(); } catch {}
            });
          },
          cancel() {
            try { ws.close(); } catch {}
          },
        });

        resolveOuter({
          response: new Response(readable, { status: 200, headers: { ...SSE_HEADERS_NO_BUFFER } }),
          url: GAPGPT_WS_URL,
          headers: {},
          transformedBody: body,
        });
      });
    }

    // Non-streaming fallback
    return new Promise((resolve) => {
      let myMessageToken = null;
      let content = "";
      let reasoningContent = "";
      let finished = false;

      const finishAndResolve = () => {
        if (finished) return;
        finished = true;
        try { ws.close(); } catch {}
        const message = { role: "assistant", content };
        if (reasoningContent) message.reasoning_content = reasoningContent;
        resolve({
          response: new Response(
            JSON.stringify({
              id,
              object: "chat.completion",
              created,
              model: clientModel,
              choices: [{ index: 0, message, finish_reason: "stop", logprobs: null }],
              usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          ),
          url: GAPGPT_WS_URL,
          headers: {},
          transformedBody: body,
        });
      };

      ws.on("open", () => {
        const rid = Math.floor(Math.random() * 1e8);
        const payload = {
          event: "new_message",
          rid,
          version: 98,
          data: {
            action: {
              type: "text_message",
              message_token: "",
              bot_name: botName,
              version: 4,
              chat_token: "",
              text: promptText,
              file_tokens: [],
              allow_downgrade: false,
              enable_user_memory: false,
              mode: "",
              mode_extra: {
                model_mode: "smart",
                model_routing_preference: "smart",
                selected_simplified_model: botName,
                routed_chat_model: botName,
              },
              chat_extra: {},
              is_temporary: false,
              messenger_browser_session: randomUUID(),
            },
            chat_token: "",
            chat_model: botName,
            message_token: "",
            allow_downgrade: false,
            enable_user_memory: false,
          },
        };
        ws.send(JSON.stringify(payload));
      });

      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());

          if (msg.event === "ack_new_message") {
            if (msg.data?.status !== "ok") {
              finished = true;
              try { ws.close(); } catch {}
              const errMsg =
                msg.data?.message ||
                `GapGPT Web authentication failed (${msg.data?.status || "unauthorized"}). Ensure cookies include both accessToken and __Host-gap_dk.`;
              resolve({
                response: errorResponse(401, errMsg),
                url: GAPGPT_WS_URL,
                headers: {},
                transformedBody: body,
              });
              return;
            }
            myMessageToken = msg.data?.message?.token;
            return;
          }

          // Ignore pre-ack messages
          if (!myMessageToken) return;

          if (msg.event === "text_response_chunk") {
            if (msg.data?.mtoken === myMessageToken) {
              content += msg.data?.text || "";
            }
            return;
          }

          if (msg.event === "agent_turn_reasoning_chunk") {
            if (msg.data?.mtoken === myMessageToken) {
              reasoningContent += msg.data?.text || "";
            }
            return;
          }

          if (msg.event === "new_message") {
            const m = msg.data?.message;
            if (!m || m.token !== myMessageToken) return;

            const responses = m.response || [];
            for (const r of responses) {
              if (r.type === "reasoning" && r.content) reasoningContent = r.content;
              if (r.type === "text" && r.content) content = r.content;
            }

            if (m.status === "completed") {
              finishAndResolve();
            } else if (m.status === "error") {
              finished = true;
              try { ws.close(); } catch {}
              resolve({
                response: errorResponse(502, m.message || "GapGPT Web returned error status"),
                url: GAPGPT_WS_URL,
                headers: {},
                transformedBody: body,
              });
            }
          }
        } catch {}
      });

      ws.on("error", (err) => {
        if (!finished) {
          finished = true;
          resolve({
            response: errorResponse(502, `GapGPT Web socket error: ${err.message}`),
            url: GAPGPT_WS_URL,
            headers: {},
            transformedBody: body,
          });
        }
      });

      ws.on("close", (code, reason) => {
        if (!finished) {
          if (content.length > 0) {
            finishAndResolve();
            return;
          }
          finished = true;
          const reasonStr = reason ? `: ${reason.toString()}` : "";
          resolve({
            response: errorResponse(
              502,
              `GapGPT Web socket closed before completion (code ${code}${reasonStr}). Check if your cookies are valid.`
            ),
            url: GAPGPT_WS_URL,
            headers: {},
            transformedBody: body,
          });
        }
      });

      signal?.addEventListener("abort", () => {
        finished = true;
        try { ws.close(); } catch {}
      });
    });
  }
}

export default GapGptWebExecutor;
