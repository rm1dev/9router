// SD WebUI (AUTOMATIC1111) — local, noAuth
import { nowSec, getReferenceImages } from "./_base.js";
import { PROVIDER_MEDIA } from "../../providers/index.js";

const BASE_URL = PROVIDER_MEDIA["sdwebui"]?.imageConfig?.baseUrl;

export default {
  noAuth: true,
  supportsReferenceImages: true,
  buildUrl: (_model, _creds, body) => body?.init_images ? BASE_URL.replace(/\/txt2img$/, "/img2img") : BASE_URL,
  buildHeaders: () => ({ "Content-Type": "application/json" }),
  buildBody: (_model, body) => {
    const { prompt, n = 1, size = "1024x1024" } = body;
    const [width, height] = size.split("x").map(Number);
    const images = getReferenceImages(body);
    if (images.some(image => /^https?:\/\//i.test(image))) throw new Error("SD WebUI references must be base64 or image data URLs");
    return { prompt, width: width || 512, height: height || 512, steps: 20, batch_size: n,
      ...(images.length ? { init_images: images, denoising_strength: body.strength ?? 0.75 } : {}),
    };
  },
  normalize: (responseBody) => {
    const images = Array.isArray(responseBody.images) ? responseBody.images.map((img) => ({ b64_json: img })) : [];
    return { created: nowSec(), data: images };
  },
};
