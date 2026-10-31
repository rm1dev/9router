// Google Gemini adapter (Nano Banana models)
import { nowSec, getReferenceImages, readReferenceImage } from "./_base.js";
import { PROVIDER_MEDIA } from "../../providers/index.js";
import { fetchPublic } from "../../../src/shared/utils/ssrfGuard.js";

const BASE_URL = PROVIDER_MEDIA["gemini"]?.imageConfig?.baseUrl;

function resolveImageInput(input) {
  if (!input || typeof input !== "string") return null;
  const dataUriMatch = input.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (dataUriMatch) {
    return { inlineData: { mimeType: dataUriMatch[1], data: dataUriMatch[2] } };
  }
  if (/^[A-Za-z0-9+/]/.test(input) && input.length > 100 && !input.startsWith("http")) {
    return { inlineData: { mimeType: "image/png", data: input } };
  }
  return null;
}

export default {
  supportsReferenceImages: true,
  buildUrl: (model, creds) => {
    const apiKey = creds?.apiKey || creds?.accessToken;
    const modelId = model.replace(/^models\//, "");
    return `${BASE_URL}/${modelId}:generateContent?key=${encodeURIComponent(apiKey)}`;
  },
  buildHeaders: () => ({ "Content-Type": "application/json" }),
  buildBody: async (_model, body) => {
    const parts = [];
    for (let image of getReferenceImages(body)) {
      if (/^https?:\/\//i.test(image)) {
        const response = await fetchPublic(image, { signal: AbortSignal.timeout(30000) });
        const blob = await readReferenceImage(response);
        if (!blob.type.startsWith("image/") || blob.size > 20 * 1024 * 1024) throw new Error("Invalid reference type or size");
        image = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`;
      }
      const inlineData = resolveImageInput(image);
      if (!inlineData) throw new Error("Gemini reference images must be base64 or image data URLs");
      parts.push(inlineData);
    }
    parts.push({ text: body.prompt });
    return {
      contents: [{ parts }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    };
  },
  normalize: (responseBody, prompt) => {
    const parts = responseBody.candidates?.[0]?.content?.parts || [];
    const images = parts.filter((p) => p.inlineData?.data).map((p) => ({ b64_json: p.inlineData.data }));
    return {
      created: nowSec(),
      data: images.length > 0 ? images : [{ b64_json: "", revised_prompt: prompt }],
    };
  },
};
