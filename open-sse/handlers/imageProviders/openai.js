// OpenAI-compatible adapter (used by openai, minimax, openrouter, recraft)
import { PROVIDER_MEDIA } from "../../providers/index.js";
import { getReferenceImages, readReferenceImage } from "./_base.js";
import { fetchPublic } from "../../../src/shared/utils/ssrfGuard.js";

const imageCfg = (id) => PROVIDER_MEDIA[id]?.imageConfig || {};
const imageUrl = (id) => imageCfg(id).baseUrl;

export default function createOpenAIAdapter(providerId) {
  const cfg = imageCfg(providerId);
  return {
    supportsReferenceImages: providerId === "openai",
    buildUrl: (_model, _creds, body) => body instanceof FormData ? imageUrl(providerId).replace(/\/generations$/, "/edits") : imageUrl(providerId),
    buildHeaders: (creds, body) => {
      const headers = { ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...(cfg.headers || {}) };
      const key = creds?.apiKey || creds?.accessToken;
      if (key) headers["Authorization"] = `Bearer ${key}`;
      return headers;
    },
    buildBody: (model, body) => {
      const references = getReferenceImages(body);
      if (references.length && providerId === "openai") return (async () => {
        if (model === "dall-e-3") throw new Error("DALL-E 3 does not support image editing");
        const form = new FormData();
        for (const field of ["prompt", "n", "size", "quality", "background", "output_format"]) {
          if (body[field] != null) form.append(field, String(body[field]));
        }
        form.append("model", model);
        for (const [i, ref] of references.entries()) {
          let blob;
          if (/^https?:\/\//i.test(ref)) {
            const response = await fetchPublic(ref, { signal: AbortSignal.timeout(30000) });
            blob = await readReferenceImage(response);
          } else {
            const match = /^data:(image\/[^;]+);base64,(.+)$/is.exec(ref);
            blob = new Blob([Buffer.from(match ? match[2] : ref, "base64")], { type: match ? match[1] : "image/png" });
          }
          if (!blob.type.startsWith("image/") || !blob.size || blob.size > 20 * 1024 * 1024) throw new Error("Invalid reference image type or size");
          form.append(references.length === 1 ? "image" : "image[]", blob, `reference-${i}.png`);
        }
        return form;
      })();
      const {
        prompt,
        n = 1,
        size = "1024x1024",
        quality,
        style,
        response_format,
        output_format,
      } = body;
      const full = { model, prompt, n, size, output_format };
      if (quality) full.quality = quality;
      if (style) full.style = style;
      if (response_format) full.response_format = response_format;
      for (const field of ["output_format", "watermark", "prompt_extend"]) {
        if (cfg.bodyFields?.includes(field) && body[field] !== undefined) {
          full[field] = body[field];
        }
      }
      // bodyFields whitelist (e.g. xAI accepts only model/prompt/n/response_format)
      if (Array.isArray(cfg.bodyFields)) {
        const req = {};
        for (const f of cfg.bodyFields) if (full[f] !== undefined) req[f] = full[f];
        return req;
      }
      return full;
    },
    normalize: (responseBody) => responseBody,
  };
}
