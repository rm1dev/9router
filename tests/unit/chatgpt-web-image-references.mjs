import assert from "node:assert/strict";
import { uploadImageReferences, imageReferenceContent } from "../../open-sse/executors/chatgpt-web/imageReferences.js";

const originalFetch = globalThis.fetch;
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZFAAAAAASUVORK5CYII=";
const calls = [];
globalThis.fetch = async (url, options) => {
  calls.push({ url: String(url), options });
  if (String(url).endsWith("/backend-api/files")) return Response.json({ file_id: "file-reference", upload_url: "https://files.oaiusercontent.com/upload" });
  return new Response("ok");
};
try {
  const refs = await uploadImageReferences({ baseUrl: "https://chatgpt.com", accessToken: "test-token", cookie: "session=test", userAgent: "test" }, [png]);
  assert.equal(refs.length, 1);
  assert.equal(calls.length, 3);
  assert.equal(calls[1].options.headers.Cookie, undefined);
  assert.equal(calls[1].options.headers.Authorization, undefined);
  assert.equal(JSON.parse(calls[2].options.body).file_id, "file-reference");
  const content = imageReferenceContent("keep the cat", refs);
  assert.equal(content.content_type, "multimodal_text");
  assert.equal(content.parts[0].asset_pointer, "sediment://file-reference");
  assert.equal(content.parts.at(-1), "keep the cat");
  assert.deepEqual(imageReferenceContent("cat", []), { content_type: "text", parts: ["cat"] });
  globalThis.fetch = async () => Response.json({ file_id: "bad", upload_url: "https://attacker.example/upload" });
  await assert.rejects(uploadImageReferences({ baseUrl: "https://chatgpt.com" }, [png]), /invalid reference upload destination/);
  console.log("ChatGPT Web image reference checks passed");
} finally {
  globalThis.fetch = originalFetch;
}
