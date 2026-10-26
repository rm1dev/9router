import WebSocket from "ws";
import { randomInt, randomUUID } from "node:crypto";
import { GAPGPT_IMAGE_GENERATION_TIMEOUT_MS } from "../config/gapgptWebImages.js";

const BASE = "https://gapgpt.app";
const IMAGE_MODELS = {
  "A-Z-IMAGE-TURBO": "Z-Image-Turbo",
  "A-FLUX1-SCHNELL": "Flux-schnell",
  "A-FLUX-PRO-KONTEXT": "Flux-pro-kontext",
  "A-FLUX-2": "Flux-2",
  "A-MIDJ": "Midjourney",
  "A-DALLE3": "DALLE-3",
  "A-SDXL": "SDXL",
  "A-GPT-IMAGE-1": "GPT-IMAGE-1",
  "A-GPT-IMAGE-1.5": "GPT-IMAGE-1.5",
  "A-GPT-IMAGE-2": "GPT-IMAGE-2",
  "A-GPT-IMAGE-2.5": "GPT-IMAGE-2.5-SUNBURST",
  "A-GEMINI-2.5-FLASH-IMAGE": "Gemini-3.1-flash-image",
  "A-GEMINI-3.1-FLASH-LITE-IMAGE": "Gemini-3.1-flash-lite-image",
  "A-GEMINI-3-PRO-IMAGE": "Gemini-3-pro-image",
};

export function generateGapGptImage({ model, prompt, cookie, signal }) {
  const id = String(model).replace(/^(gapgpt-web|gg-web)\//i, "");
  const imageModel = IMAGE_MODELS[id] || id;
  if (!prompt || typeof prompt !== "string") throw new Error("Image prompt is required");
  if (!cookie?.includes("accessToken=") || !cookie?.includes("__Host-gap_dk=")) {
    throw Object.assign(new Error("GapGPT requires accessToken and __Host-gap_dk cookies"), { status: 401 });
  }
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${BASE.replace("https:", "wss:")}/ws/salam`, {
      headers: { Cookie: cookie, Origin: BASE, "X-Auth-Cookie": "1" },
      handshakeTimeout: 15000,
    });
    let settled = false;
    let rid;
    let chatToken;
    let messageToken;
    let generating = false;
    const timer = setTimeout(() => finish(new Error("GapGPT image generation timed out")), GAPGPT_IMAGE_GENERATION_TIMEOUT_MS);
    const abort = () => finish(new Error("GapGPT image generation aborted"));
    function finish(error, urls) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      ws.close();
      if (error) reject(error);
      else resolve(urls);
    }
    function send(action) {
      rid = randomInt(100000000);
      ws.send(JSON.stringify({ event: "new_message", rid, version: 98, data: {
        action, chat_token: chatToken || "", chat_model: "A-GAP",
        message_token: messageToken || "", allow_downgrade: false, enable_user_memory: false,
      } }));
    }
    ws.on("open", () => {
      if (signal?.aborted) return abort();
      // Bootstrap a message anchor without exposing the image prompt to a text model.
      send({ type: "text_message", bot_name: "A-GAP", version: 4,
        chat_token: "", text: "Reply OK only.", file_tokens: [], mode: "",
        mode_extra: {}, is_temporary: true, messenger_browser_session: randomUUID(),
      });
    });
    ws.on("message", raw => {
      if (settled) return;
      let event;
      try { event = JSON.parse(raw.toString()); } catch { return; }
      if (event.event === "ack_new_message" && event.rid === rid) {
        if (event.data?.status !== "ok") {
          const status = event.data?.status;
          return finish(Object.assign(new Error(typeof event.data?.message === "string" ? event.data.message : `GapGPT rejected image request: ${status}`), {
            status: status === "unauthorized" ? 401 : /limit|upgrade/.test(status) ? 429 : 502,
          }));
        }
        if (!messageToken) {
          messageToken = event.data?.message?.token;
          chatToken = event.data?.chat_token;
        }
        return;
      }
      const message = event.data?.message;
      if (event.event !== "new_message" || !messageToken || message?.token !== messageToken) return;
      if (!generating && message.status === "completed") {
        generating = true;
        send({ type: "generate_image", message_token: messageToken,
          prompt, model: imageModel, reference_file_tokens: [],
        });
        return;
      }
      if (!generating) return;
      const urls = (message.response || []).filter(block =>
        block.type === "generated-image-v2" && !block.is_video && block.model === imageModel && block.prompt === prompt
      ).flatMap(block => block.urls || []);
      if (urls.length) return finish(null, urls);
      if (message.status === "error") finish(new Error("GapGPT image generation failed"));
    });
    ws.on("error", error => finish(error));
    ws.on("close", code => { if (!settled) finish(new Error(`GapGPT image socket closed before result (${code})`)); });
    signal?.addEventListener("abort", abort, { once: true });
  });
}
