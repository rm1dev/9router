import assert from "node:assert/strict";
import { normalizeImageReferences, getReferenceImages } from "../../open-sse/handlers/imageProviders/_base.js";
import codex from "../../open-sse/handlers/imageProviders/codex.js";
import gemini from "../../open-sse/handlers/imageProviders/gemini.js";
import nano from "../../open-sse/handlers/imageProviders/nanobanana.js";
import runway from "../../open-sse/handlers/imageProviders/runwayml.js";
import sd from "../../open-sse/handlers/imageProviders/sdwebui.js";
import createOpenAI from "../../open-sse/handlers/imageProviders/openai.js";

const ref = "data:image/png;base64,QUJD";
for (const field of ["image", "images", "reference_image", "reference_images"]) {
  const body = normalizeImageReferences({ prompt: "cat", [field]: field.endsWith("s") ? [ref] : ref });
  assert.deepEqual(getReferenceImages(body), [ref]);
  assert.equal(codex.buildBody("gpt-image-2.5", body).tools[0].action, "edit");
  assert.equal((await gemini.buildBody("gemini", body)).contents[0].parts[0].inlineData.data, "QUJD");
  assert.deepEqual(nano.buildBody("nano", body).imageUrls, [ref]);
  assert.deepEqual(runway.buildBody("gen4_image", body).referenceImages, [{ uri: ref }]);
  const sdBody = sd.buildBody("sd", body);
  assert.deepEqual(sdBody.init_images, [ref]);
  assert.ok(sd.buildUrl("sd", null, sdBody).endsWith("/img2img"));
  const openai = createOpenAI("openai");
  const form = await openai.buildBody("gpt-image-2.5", body);
  assert.ok(form.get("image") instanceof Blob);
  assert.ok(openai.buildUrl("gpt-image-2.5", null, form).endsWith("/edits"));
  assert.equal(openai.buildHeaders({}, form)["Content-Type"], undefined);
}
assert.deepEqual(getReferenceImages({ image: ref, images: [ref] }), [ref]);
assert.throws(() => normalizeImageReferences({ image: {} }), /Invalid reference/);
assert.throws(() => normalizeImageReferences({ image: "file:///etc/passwd" }), /Invalid reference/);
console.log("Image reference input checks passed");
