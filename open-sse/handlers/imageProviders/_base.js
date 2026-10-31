// Shared helpers for image provider adapters

export const POLL_INTERVAL_MS = 1500;
export const POLL_TIMEOUT_MS = 120000;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Map OpenAI size to provider-specific aspect ratio
export function sizeToAspectRatio(size) {
  if (!size || typeof size !== "string") return "1:1";
  const map = {
    "1024x1024": "1:1",
    "1024x1792": "9:16",
    "1792x1024": "16:9",
    "1024x1536": "2:3",
    "1536x1024": "3:2",
  };
  return map[size] || "1:1";
}

// Fetch URL → base64 (for providers returning image URLs)
export async function urlToBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString("base64");
}

export function nowSec() {
  return Math.floor(Date.now() / 1000);
}

// Canonicalize aliases once at the API boundary; never duplicate singular + plural inputs.
export function normalizeImageReferences(body) {
  const images = [body.reference_images, body.images, body.reference_image, body.image]
    .flatMap(value => value == null ? [] : Array.isArray(value) ? value : [value])
    .map(value => {
      if (value && typeof value === "object") {
        value = value.image_url?.url || value.url || value.data || value.b64_json;
      }
      if (typeof value !== "string" || !value.trim()) throw new Error("Invalid reference image: expected URL, data URL or base64");
      value = value.trim();
      if (!/^https?:\/\//i.test(value) && !/^data:image\/[\w.+-]+;base64,[A-Za-z0-9+/=\s]+$/i.test(value) && !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
        throw new Error("Invalid reference image encoding");
      }
      return value;
    });
  const result = { ...body };
  for (const key of ["image", "images", "reference_image", "reference_images"]) delete result[key];
  if (images.length) {
    const unique = [...new Set(images)];
    if (unique.length === 1) result.image = unique[0];
    else result.images = unique;
  }
  return result;
}

export function getReferenceImages(body) {
  const normalized = normalizeImageReferences(body);
  return normalized.images || (normalized.image ? [normalized.image] : []);
}

export async function readReferenceImage(response) {
  if (!response.ok) throw new Error(`Reference download failed (${response.status})`);
  const type = (response.headers.get("content-type") || "").split(";")[0];
  if (!type.startsWith("image/")) {
    await response.body?.cancel();
    throw new Error("Reference URL did not return an image");
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 20 * 1024 * 1024) throw new Error("Reference image exceeds 20 MB");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  if (!size) throw new Error("Reference image is empty");
  return new Blob(chunks, { type });
}
