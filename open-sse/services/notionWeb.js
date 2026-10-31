import { loadRuntimeDep } from "./lazyRuntime.js";
import { normalizeSessionCookieHeader } from "../utils/webCookieAuth.js";

export const NOTION_ORIGIN = "https://app.notion.com";
// ponytail: observed web client version; update from Notion's request headers if its API rejects this version.
const CLIENT_VERSION = "23.13.20261031.1141";
let sessionPromise;

export function notionCookie(credentials) {
  const raw = typeof credentials === "string" ? credentials : credentials?.cookie || credentials?.apiKey || credentials?.accessToken;
  const cookie = normalizeSessionCookieHeader(raw, "token_v2");
  if (!/(?:^|;\s*)token_v2=[^;\s]+/.test(cookie) || /[\r\n]/.test(cookie)) throw Object.assign(new Error("Missing or invalid Notion token_v2 cookie"), { status: 401 });
  return cookie;
}

export async function notionRequest(cookie, endpoint, data, { signal, userId, spaceId } = {}) {
  signal?.throwIfAborted();
  if (!sessionPromise) {
    sessionPromise = loadRuntimeDep("wreq-js").then((wreq) => wreq.createSession({ browser: "chrome_146", os: "macos" })).catch((error) => {
      sessionPromise = undefined;
      throw error;
    });
  }
  let session;
  try { session = await sessionPromise; } catch {
    throw Object.assign(new Error("Notion Web requires the wreq-js native runtime. Reinstall the optional runtime dependency."), { status: 503 });
  }
  const response = await session.fetch(`${NOTION_ORIGIN}/api/v3/${endpoint}`, {
    method: "POST",
    redirect: "error",
    timeout: 30000,
    ...(signal ? { signal } : {}),
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Origin: NOTION_ORIGIN,
      Referer: `${NOTION_ORIGIN}/`,
      "notion-client-version": CLIENT_VERSION,
      ...(userId ? { "x-notion-active-user-header": userId } : {}),
      ...(spaceId ? { "x-notion-space-id": spaceId } : {}),
    },
    body: JSON.stringify(data),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || json?.isNotionError) {
    const status = response.status === 200 ? 502 : response.status;
    throw Object.assign(new Error(json?.message || `Notion returned HTTP ${response.status}`), { status });
  }
  if (!json || typeof json !== "object") throw Object.assign(new Error("Notion returned invalid JSON"), { status: 502 });
  return json;
}

export function notionWorkspaces(spaces) {
  const candidates = [];
  for (const [userId, records] of Object.entries(spaces)) {
    const user = records.notion_user?.[userId]?.value?.value;
    if (!user?.id) continue;
    for (const [spaceId, entry] of Object.entries(records.space || {})) {
      const space = entry.value?.value;
      if (space?.id && !space.settings?.disable_ai_feature) candidates.push({ userId, spaceId, name: space.name || spaceId, email: user.email || "", tier: space.subscription_tier });
    }
  }
  return candidates;
}

export async function listNotionWorkspaces(cookie, signal) {
  return notionWorkspaces(await notionRequest(cookie, "getSpaces", {}, { signal }));
}

export async function resolveNotionAccount(cookie, { spaceId: requestedSpaceId, signal } = {}) {
  const candidates = await listNotionWorkspaces(cookie, signal);
  // ponytail: legacy connections retain automatic selection until the user logs in again.
  const account = requestedSpaceId ? candidates.find((item) => item.spaceId === requestedSpaceId) : candidates.find((item) => item.tier === "business" || item.tier === "enterprise") || candidates[0];
  if (!account) throw Object.assign(new Error(requestedSpaceId ? "Notion workspace is unavailable to this session" : "Notion session has no accessible AI workspace"), { status: 401 });
  return account;
}

export async function fetchNotionModels(credentials, signal) {
  const cookie = notionCookie(credentials);
  const account = await resolveNotionAccount(cookie, { spaceId: credentials?.providerSpecificData?.spaceId, signal });
  const data = await notionRequest(cookie, "getAvailableModels", { spaceId: account.spaceId }, { ...account, signal });
  if (!Array.isArray(data.models) || !data.models.length) throw Object.assign(new Error("Notion returned an empty or incomplete model catalog"), { status: 502 });
  return [
    { id: "auto", name: "Auto" },
    ...data.models.filter((model) => model.agentService && !model.isDisabled && !model.agentService.isDisabled && !model.restrictedForPersonalAgent).map((model) => ({
      id: model.model,
      name: model.modelMessage || model.model,
    })),
  ];
}
