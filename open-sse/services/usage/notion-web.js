import { notionCookie, notionRequest, resolveNotionAccount } from "../notionWeb.js";

export function parseNotionUsage(data, account) {
  const basic = data.basicCredits;
  if (!basic || !Number.isFinite(basic.userUsage) || !Number.isFinite(basic.userLimit)) throw new Error("Notion returned incomplete credit usage");
  const quota = (used, total) => ({ used, total, remaining: Math.max(0, total - used), unlimited: false, resetAt: null });
  const quotas = { "User basic credits": quota(basic.userUsage, basic.userLimit) };
  if (Number.isFinite(basic.spaceUsage) && Number.isFinite(basic.spaceLimit)) quotas["Workspace basic credits"] = quota(basic.spaceUsage, basic.spaceLimit);
  for (const [name, source] of Object.entries(data.premiumCredits?.perSource || {})) {
    if (Number.isFinite(source.usageTotal) && Number.isFinite(source.limit) && source.limit > 0) quotas[`Premium ${name}`] = quota(source.usageTotal, source.limit);
  }
  return { plan: `${account.name} (${account.tier || "Notion"})`, quotas };
}

export async function getNotionUsage(connection) {
  const cookie = notionCookie(connection);
  const account = await resolveNotionAccount(cookie, { spaceId: connection.providerSpecificData?.spaceId });
  const data = await notionRequest(cookie, "getAIUsageEligibilityV2", { spaceId: account.spaceId }, account);
  return parseNotionUsage(data, account);
}
