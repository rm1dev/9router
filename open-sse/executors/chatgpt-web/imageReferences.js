import { resolveChatGptWebAttachments } from "./attachments.js";
import { fetchPublic } from "../../../src/shared/utils/ssrfGuard.js";
import { readReferenceImage } from "../../handlers/imageProviders/_base.js";

export async function uploadImageReferences(ctx, images, signal) {
  if (images.length > 10) throw Object.assign(new Error("ChatGPT accepts at most 10 reference images"), { status: 400 });
  const sources = [];
  for (let ref of images) {
    if (/^https?:\/\//i.test(ref)) {
      const blob = await readReferenceImage(await fetchPublic(ref, { signal: signal || AbortSignal.timeout(30000) }));
      ref = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`;
    } else if (!ref.startsWith("data:")) ref = `data:image/png;base64,${ref}`;
    sources.push({ kind: "image", ref, name: `reference-${sources.length}.png` });
  }
  const attachments = await resolveChatGptWebAttachments(sources);
  const headers = { Authorization: `Bearer ${ctx.accessToken}`, Cookie: ctx.cookie,
    "User-Agent": ctx.userAgent, "Content-Type": "application/json", ...ctx.sentinel };
  const registered = [];
  for (const attachment of attachments) {
    const response = await fetch(`${ctx.baseUrl}/backend-api/files`, {
      method: "POST", headers, redirect: "error", signal,
      body: JSON.stringify({ file_name: attachment.name, file_size: attachment.size,
        use_case: "multimodal", mime_type: attachment.mimeType, timezone_offset_min: 0,
        reset_rate_limits: false, supports_direct_azure_multipart: true,
        entry_surface: "chat_composer", selection_method: "file_picker", store_in_library: false }),
    });
    if (!response.ok) throw Object.assign(new Error(`ChatGPT reference registration failed (${response.status})`), { status: response.status });
    const { file_id: fileId, upload_url: uploadUrl } = await response.json();
    const url = new URL(uploadUrl);
    if (!fileId || url.protocol !== "https:" || url.username || url.password || !/(?:^|\.)oaiusercontent\.com$/i.test(url.hostname)) {
      throw new Error("ChatGPT returned an invalid reference upload destination");
    }
    const upload = await fetch(url, { method: "PUT", redirect: "error", signal,
      headers: { "Content-Type": attachment.mimeType, "x-ms-blob-type": "BlockBlob", "x-ms-version": "2020-04-08" },
      body: attachment.data });
    if (!upload.ok) throw new Error(`ChatGPT reference upload failed (${upload.status})`);
    const processed = await fetch(`${ctx.baseUrl}/backend-api/files/process_upload_stream`, {
      method: "POST", headers, redirect: "error", signal,
      body: JSON.stringify({ file_id: fileId, use_case: "multimodal", index_for_retrieval: false,
        file_name: attachment.name, entry_surface: "chat_composer", metadata: { store_in_library: false, is_temporary_chat: true } }),
    });
    await processed.text();
    if (!processed.ok) throw new Error(`ChatGPT reference processing failed (${processed.status})`);
    registered.push({ ...attachment, fileId });
  }
  return registered;
}

export function imageReferenceContent(prompt, attachments) {
  return attachments.length ? { content_type: "multimodal_text", parts: [
    ...attachments.map(item => ({ content_type: "image_asset_pointer", asset_pointer: `sediment://${item.fileId}`,
      size_bytes: item.size, width: item.width, height: item.height })), prompt,
  ] } : { content_type: "text", parts: [prompt] };
}
