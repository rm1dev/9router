import { nowSec, getReferenceImages } from "./_base.js";
import { generateGapGptImage } from "../../executors/gapgpt-web-images.js";
import { assertPublicUrlResolved } from "../../../src/shared/utils/ssrfGuard.js";
import { GAPGPT_IMAGE_DOWNLOAD_TIMEOUT_MS, GAPGPT_IMAGE_MAX_BYTES, GAPGPT_IMAGE_MAX_REDIRECTS } from "../../config/gapgptWebImages.js";

export async function downloadGapGptImage(value, cookie) {
  let url = new URL(value);
  const signal = AbortSignal.timeout(GAPGPT_IMAGE_DOWNLOAD_TIMEOUT_MS);
  for (let hop = 0; hop <= GAPGPT_IMAGE_MAX_REDIRECTS; hop++) {
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Unsupported GapGPT image redirect");
    await assertPublicUrlResolved(url.href);
    const authenticated = url.origin === "https://gapgpt.app" && url.pathname.startsWith("/api/v1/files/server/");
    const response = await fetch(url, {
      headers: authenticated ? { Cookie: cookie, "X-Auth-Cookie": "1" } : {},
      redirect: "manual", signal,
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location || hop === GAPGPT_IMAGE_MAX_REDIRECTS) throw new Error("GapGPT image redirect limit exceeded");
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`GapGPT image download failed (${response.status})`);
    }
    const mime = response.headers.get("content-type") || "";
    if (!mime.startsWith("image/")) {
      await response.body?.cancel();
      throw new Error("GapGPT returned non-image content");
    }
    const chunks = [];
    let size = 0;
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        size += chunk.byteLength;
        if (size > GAPGPT_IMAGE_MAX_BYTES) throw new Error("GapGPT image exceeds size limit");
        chunks.push(Buffer.from(chunk));
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    if (!size) throw new Error("GapGPT returned an empty image");
    return { b64_json: Buffer.concat(chunks).toString("base64"), mime_type: mime.split(";")[0] };
  }
}

export default {
  supportsReferenceImages: true,
  useExecutor: true,
  buildUrl: () => "",
  buildHeaders: () => ({}),
  buildBody: () => ({}),
  async executeViaExecutor(model, body, credentials) {
    const cookie = credentials?.cookie || credentials?.apiKey || credentials?.accessToken || credentials?.providerSpecificData?.cookie;
    const n = Number(body.n ?? 1);
    if (!Number.isInteger(n) || n < 1 || n > 4) {
      throw Object.assign(new Error("n must be an integer between 1 and 4"), { status: 400 });
    }
    const data = [];
    for (let i = 0; i < n; i++) {
      const urls = await generateGapGptImage({ model, prompt: body.prompt, cookie, images: getReferenceImages(body) });
      for (const value of urls) {
        const url = new URL(value);
        // Never forward session cookies to a model-controlled or redirected host.
        if (url.origin !== "https://gapgpt.app" || !url.pathname.startsWith("/api/v1/files/server/") || url.username || url.password) {
          throw new Error("GapGPT returned an unsupported image URL");
        }
        data.push(await downloadGapGptImage(url.href, cookie));
      }
    }
    return { created: nowSec(), data };
  },
  normalize: response => response,
};
