import assert from "node:assert/strict";
import adapter from "../../open-sse/handlers/imageProviders/codex.js";

for (const field of ["image", "images", "reference_image", "reference_images"]) {
  const value = "data:image/png;base64,QUJD";
  const body = adapter.buildBody("gpt-image-2.5", {
    prompt: "Keep the cat, change the background",
    [field]: field.endsWith("s") ? [value] : value,
  });
  assert.equal(body.tools[0].action, "edit");
  assert.deepEqual(body.input[0].content.filter(item => item.type === "input_image")
    .map(item => item.image_url), [value]);
}
assert.equal(adapter.buildBody("gpt-image-2.5", { prompt: "A cat" }).tools[0].action, "generate");
console.log("Codex reference image checks passed");
