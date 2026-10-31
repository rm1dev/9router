import { NextResponse } from "next/server";
import { createProviderConnection, deleteProviderConnection, getProviderConnections, updateProviderConnection } from "@/models";
import { AI_PROVIDERS } from "@/shared/constants/providers";
import { startWebLogin, getWebLoginStatus, cancelWebLogin, listWebLoginProfiles } from "open-sse/services/webLogin.js";
import { getWebLoginConfig, listWebLoginProviders } from "open-sse/services/webLoginConfig.js";
import { fetchWebIdentity } from "open-sse/services/webIdentity.js";

/**
 * Interactive web login: open a headed browser at the provider's login page,
 * let the user log in by hand, harvest cookies/localStorage, auto-create the
 * connection. The cookie itself never travels back to the client — only a
 * short preview does.
 */

// GET /api/providers/web-login            → supported provider list
// GET /api/providers/web-login?provider=x → session status (saves once on success)
export async function GET(request) {
  const provider = request.nextUrl.searchParams.get("provider");
  if (!provider) {
    return NextResponse.json({ providers: listWebLoginProviders(), profiles: listWebLoginProfiles() });
  }
  const session = getWebLoginStatus(provider);
  if (!session) {
    return NextResponse.json({ error: "No login session for this provider" }, { status: 404 });
  }

  if (session.status === "success" && !session.savedConnectionId) {
    try {
      const config = getWebLoginConfig(provider);
      if (provider === "notion-web" && !session.selectedWorkspace) {
        const { listNotionWorkspaces } = await import("open-sse/services/notionWeb.js");
        session.workspaces ||= await listNotionWorkspaces(session.credential);
        if (!session.workspaces.length) throw new Error("No accessible Notion AI workspace");
        if (session.workspaces.length === 1) session.selectedWorkspace = session.workspaces[0];
        else return NextResponse.json({ provider, status: "select_workspace", workspaces: session.workspaces.map(({ spaceId, name, tier }) => ({ spaceId, name, tier })) });
      }
      const identity = await fetchWebIdentity(provider, session.credential);
      // A login that just finished in the browser is authoritative: an
      // "invalid" verdict here means the probe endpoint rejected the request
      // shape, not that the user's session is stale.
      if (identity.status === "invalid") {
        session.status = "error";
        session.error = identity.error || "The captured session was rejected";
        return NextResponse.json({
          provider,
          status: session.status,
          profile: session.profile || null,
          error: session.error,
        });
      }

      const providerName = AI_PROVIDERS[provider]?.name || provider;
      const email = identity.email || "";
      const name = session.selectedWorkspace ? `${email || providerName} · ${session.selectedWorkspace.name}` : email || providerName;
      session.accountEmail = email;
      const providerSpecificData = {
        authMethod: "web-login",
        ...(session.selectedWorkspace ? { spaceId: session.selectedWorkspace.spaceId, spaceName: session.selectedWorkspace.name } : {}),
        ...(config?.credentialFrom === "localStorageValue" ? { tokenSource: "localStorage" } : {}),
      };

      // Re-login refreshes the credential in place. Match by account email so a
      // second Google account keeps its own row; providers that expose no email
      // fall back to the single web-login row this button created.
      const webLoginRows = (await getProviderConnections({ provider }))
        .filter((c) => c.providerSpecificData?.authMethod === "web-login" && (!session.selectedWorkspace || c.providerSpecificData?.spaceId === session.selectedWorkspace.spaceId))
        .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      const existing = email
        ? webLoginRows.find((c) => c.email === email)
        : webLoginRows.length === 1 ? webLoginRows[0] : null;

      if (existing) {
        const updated = await updateProviderConnection(existing.id, {
          apiKey: session.credential,
          name,
          email: email || existing.email || null,
          providerSpecificData: { ...existing.providerSpecificData, ...providerSpecificData },
          testStatus: "active",
          lastError: null,
          lastErrorAt: null,
          isActive: true,
        });
        session.savedConnectionId = updated?.id || existing.id;
        // Same account logged in twice used to leave a stale duplicate row.
        for (const duplicate of webLoginRows) {
          if (duplicate.id === existing.id || duplicate.email !== email || !email) continue;
          await deleteProviderConnection(duplicate.id);
        }
      } else {
        const connection = await createProviderConnection({
          provider,
          authType: "cookie",
          name,
          email: email || null,
          apiKey: session.credential,
          priority: 1,
          providerSpecificData,
          isActive: true,
          // Harvested from a live logged-in session, so the credential is known good.
          testStatus: "active",
          allowOverwrite: false,
        });
        session.savedConnectionId = connection.id;
      }
      session.credential = undefined; // drop the secret once persisted
    } catch (error) {
      session.status = "error";
      session.error = error?.code === "PROVIDER_NAME_CONFLICT"
        ? `A connection named "${error.existingName}" already exists — edit or delete it first`
        : error?.message || "Failed to save connection";
    }
  }

  return NextResponse.json({
    provider,
    status: session.status,
    profile: session.profile || null,
    error: session.error || null,
    connectionId: session.savedConnectionId || null,
    email: session.accountEmail || null,
    credentialPreview: session.credential ? `${session.credential.slice(0, 10)}…` : null,
  });
}

// POST /api/providers/web-login {provider, profile?} → start login window
export async function POST(request) {
  try {
    const body = await request.json();
    const provider = String(body?.provider || "").trim();
    const profile = String(body?.profile || "").trim() || "default";
    if (!getWebLoginConfig(provider)) {
      return NextResponse.json({ error: `Web login not supported for "${provider}"` }, { status: 400 });
    }
    const session = await startWebLogin(provider, profile);
    return NextResponse.json({ provider, profile: session.profile, status: session.status }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Failed to start login" }, { status: 500 });
  }
}

// PATCH finalizes a captured Notion session only after an authorized workspace selection.
export async function PATCH(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const session = getWebLoginStatus("notion-web");
  if (body?.provider !== "notion-web" || session?.status !== "success" || session.savedConnectionId || !session.credential) {
    return NextResponse.json({ error: "No Notion login awaiting workspace selection" }, { status: 409 });
  }
  const workspace = session.workspaces?.find((item) => item.spaceId === body.spaceId);
  if (!workspace) return NextResponse.json({ error: "Invalid workspace selection" }, { status: 400 });
  session.selectedWorkspace = workspace;
  return GET({ nextUrl: new URL("http://localhost/api/providers/web-login?provider=notion-web") });
}

// DELETE /api/providers/web-login?provider=x → cancel a running session
export async function DELETE(request) {
  const provider = request.nextUrl.searchParams.get("provider");
  if (!provider) {
    return NextResponse.json({ error: "provider is required" }, { status: 400 });
  }
  return NextResponse.json({ cancelled: cancelWebLogin(provider) });
}
