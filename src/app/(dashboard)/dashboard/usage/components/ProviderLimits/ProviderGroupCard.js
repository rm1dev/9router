"use client";

import { useState, useMemo } from "react";
import Card from "@/shared/components/Card";
import ProviderIcon from "@/shared/components/ProviderIcon";
import Toggle from "@/shared/components/Toggle";
import Tooltip from "@/shared/components/Tooltip";
import QuotaTable from "./QuotaTable";
import QuotaTableBar, { getQuotaColorClasses } from "./QuotaTableBar";
import {
  calculateProviderGroupSummary,
  filterQuotasByVisibility,
  formatResetTime,
  formatResetTimeDisplay,
  getConnectionLabel,
  getHiddenQuotaRows,
} from "./utils";
import { AI_PROVIDERS } from "@/shared/constants/providers";

const INITIAL_DISPLAY_COUNT = 6;

const AUTO_PING_SETTINGS_KEYS = {
  claude: "claudeAutoPing",
  codex: "codexAutoPing",
};

const AUTO_PING_TOOLTIPS = {
  claude:
    "When your 5h quota runs out, auto-sends a request the moment it resets so a new window starts right away.",
  codex:
    "Auto-starts the next 5h Codex window after reset by sending a tiny gpt-5.5 request. Consumes a small amount of quota.",
};

const KIRO_METHOD_LABELS = {
  "builder-id": "AWS Builder ID",
  idc: "IAM Identity Center",
  google: "Google",
  github: "GitHub",
  imported: "Imported Token",
  api_key: "API Key",
};

function kiroMethodLabel(conn) {
  const m = conn.providerSpecificData?.authMethod;
  if (m && KIRO_METHOD_LABELS[m]) return KIRO_METHOD_LABELS[m];
  return conn.authType === "api_key" ? "API Key" : "OAuth";
}

function kiroRegion(conn) {
  const r = conn.providerSpecificData?.region;
  if (r) return r;
  const arn = conn.providerSpecificData?.profileArn;
  const seg = typeof arn === "string" ? arn.split(":")[3] : "";
  return seg || "";
}

function providerLabel(providerId) {
  return AI_PROVIDERS[providerId]?.name || providerId;
}

function getConnectionSecondaryLabel(connection) {
  if (
    connection.name?.trim() &&
    connection.email?.trim() &&
    connection.name.trim() !== connection.email.trim()
  ) {
    return connection.email.trim();
  }

  if (
    connection.name?.trim() &&
    connection.displayName?.trim() &&
    connection.name.trim() !== connection.displayName.trim()
  ) {
    return connection.displayName.trim();
  }

  return null;
}

function getCodexResetCreditCount(quota) {
  const value = quota?.raw?.resetCredits?.availableCount;
  const count = typeof value === "number" ? value : Number(value);
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

export default function ProviderGroupCard({
  group,
  quotaData = {},
  errors = {},
  loading = {},
  quotaVisibility = {},
  isExpanded = false,
  onToggleExpand,
  onRefreshAccount,
  onRefreshGroup,
  onToggleAccountActive,
  onEditConnection,
  onDeleteConnection,
  onHideQuota,
  onShowQuota,
  togglingId = null,
  deletingId = null,
  resettingLimitId = null,
  autoPingMaps = {},
  toggleAutoPing,
  onResetCodexLimit,
  onViewCodexResetCredits,
  onViewClaudeResets,
  quotaSortMode = "default",
}) {
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);
  const [warningTooltipOpen, setWarningTooltipOpen] = useState(false);

  const provider = group.provider;
  const connections = group.connections || [];

  const summary = useMemo(
    () =>
      calculateProviderGroupSummary(
        provider,
        connections,
        quotaData,
        errors,
        loading,
        quotaVisibility,
      ),
    [provider, connections, quotaData, errors, loading, quotaVisibility],
  );

  const visibleConnections = isExpanded
    ? connections.slice(0, displayCount)
    : [];

  const hasMoreAccounts = connections.length > displayCount;

  return (
    <Card padding="none" className="min-w-0 transition-all duration-200">
      {/* Provider Header */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-controls={`provider-group-${provider}`}
        onClick={onToggleExpand}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleExpand();
          }
        }}
        className="flex cursor-pointer items-center justify-between gap-3 border-b border-black/10 px-3.5 py-2.5 transition-colors hover:bg-black/[0.02] dark:border-white/10 dark:hover:bg-white/[0.02]"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/5 p-1 dark:bg-white/5">
            <ProviderIcon
              src={`/providers/${provider}.png`}
              alt={provider}
              size={32}
              className="object-contain"
              fallbackText={provider?.slice(0, 2).toUpperCase() || "PR"}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-text-primary">
                {providerLabel(provider)}
              </h3>
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium text-text-muted dark:bg-white/10">
                {group.totalAccounts}{" "}
                {group.totalAccounts === 1 ? "account" : "accounts"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
              {group.inactiveAccounts > 0 ? (
                <span>
                  {group.activeAccounts} active · {group.inactiveAccounts} off
                </span>
              ) : (
                <span>{group.activeAccounts} active</span>
              )}
              {summary.loadingCount > 0 && (
                <span className="inline-flex items-center gap-1 text-primary">
                  <span className="material-symbols-outlined text-[13px] animate-spin">
                    progress_activity
                  </span>
                  <span>Updating {summary.loadingCount}...</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Tooltip text="Refresh all accounts in this provider">
            <button
              type="button"
              onClick={() => onRefreshGroup(provider)}
              aria-label={`Refresh all ${providerLabel(provider)} accounts`}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/5"
            >
              <span
                className={`material-symbols-outlined text-[18px] ${
                  summary.loadingCount > 0 ? "animate-spin" : ""
                }`}
              >
                refresh
              </span>
            </button>
          </Tooltip>
          <button
            type="button"
            onClick={onToggleExpand}
            aria-label={isExpanded ? "Collapse accounts" : "Expand accounts"}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-transform duration-200 hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/5"
          >
            <span
              className={`material-symbols-outlined text-[20px] transition-transform duration-200 ${
                isExpanded ? "rotate-180" : ""
              }`}
            >
              expand_more
            </span>
          </button>
        </div>
      </div>

      {/* Quota Summary (Conservative metrics across accounts) */}
      <div className="px-3.5 py-3">
        {summary.buckets.length > 0 ? (
          <div className="space-y-2.5">
            {summary.buckets.map((bucket) => {
              const colorClasses = getQuotaColorClasses(bucket.availablePercent);

              const countdown = formatResetTime(bucket.nextUsableResetAt);
              const resetDisplay = formatResetTimeDisplay(
                bucket.nextUsableResetAt,
              );
              const recurring = bucket.recurring !== false;
              const countdownLabel = recurring
                ? `in ${countdown}`
                : `expires in ${countdown}`;

              return (
                <div key={bucket.bucketKey} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex min-w-0 items-center gap-1.5 font-medium text-text-primary">
                      <span className="truncate">{bucket.name}</span>
                      <span className="shrink-0 text-[10px] text-text-muted">
                        ({bucket.checkedAccounts}/{bucket.totalAccounts}{" "}
                        checked)
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`font-semibold tabular-nums ${colorClasses.text}`}
                        title={`${bucket.usableAccounts} of ${bucket.checkedAccounts} checked accounts have quota; average remaining among usable accounts: ${bucket.availablePercent}%`}
                      >
                        {bucket.usableAccounts}/{bucket.checkedAccounts} usable
                        {bucket.usableAccounts > 0 ? ` · Avg ${bucket.availablePercent}%` : ""}
                      </span>
                      {bucket.exhaustedAccounts > 0 && (
                        <span className="text-[10px] text-text-muted">
                          {bucket.exhaustedAccounts} empty
                        </span>
                      )}
                      {countdown !== "-" && (
                        <span
                          className="text-[11px] text-text-muted tabular-nums"
                          title={resetDisplay ? `Next reset among usable accounts: ${resetDisplay}` : ""}
                        >
                          {countdownLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  {!bucket.unlimited && !bucket.isCreditBalance && (
                    <QuotaTableBar remaining={bucket.availablePercent} compact colors={colorClasses} />
                  )}
                </div>
              );
            })}
          </div>
        ) : summary.loadingCount > 0 ? (
          <div className="flex items-center justify-center gap-2 py-3 text-xs text-text-muted">
            <span className="material-symbols-outlined text-[18px] animate-spin">
              progress_activity
            </span>
            <span>Fetching quota limits...</span>
          </div>
        ) : (
          <div className="py-2 text-center text-xs text-text-muted">
            No quota limits reported for this provider
          </div>
        )}
      </div>

      {/* Yellow Warning Badge (when 1 or more accounts fail) */}
      {summary.errorCount > 0 && (
        <div className="relative border-t border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <div className="flex items-center justify-between gap-2">
            <div
              className="flex min-w-0 cursor-pointer items-center gap-1.5"
              onMouseEnter={() => setWarningTooltipOpen(true)}
              onMouseLeave={() => setWarningTooltipOpen(false)}
              onClick={() => setWarningTooltipOpen((prev) => !prev)}
            >
              <span className="material-symbols-outlined shrink-0 text-[16px] text-amber-500">
                warning
              </span>
              <span className="font-medium">
                {summary.errorCount}{" "}
                {summary.errorCount === 1
                  ? "account has error"
                  : "accounts have errors"}
              </span>
              <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80">
                (hover for details)
              </span>
            </div>

            <button
              type="button"
              onClick={onToggleExpand}
              className="rounded px-1.5 py-0.5 text-[11px] font-medium text-amber-600 underline-offset-2 hover:underline dark:text-amber-400"
            >
              {isExpanded ? "Hide accounts" : "Show and retry"}
            </button>
          </div>

          {/* Error Details Popover on Hover / Click */}
          {warningTooltipOpen && (
            <div className="absolute bottom-full left-3 right-3 z-30 mb-1.5 max-h-48 overflow-y-auto rounded-xl border border-amber-500/30 bg-surface p-2.5 shadow-xl shadow-black/10 backdrop-blur dark:border-amber-500/30">
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-text-primary">
                <span>Account Errors ({summary.errorCount}):</span>
                <span className="text-[10px] text-text-muted">
                  Click account retry below
                </span>
              </div>
              <div className="space-y-1">
                {summary.failedAccounts.map((fail) => (
                  <div
                    key={fail.connectionId}
                    className="flex flex-col gap-0.5 rounded-lg bg-amber-500/10 p-1.5 text-[11px] text-text-primary"
                  >
                    <div className="flex items-center justify-between gap-2 font-medium">
                      <span className="truncate">{fail.accountLabel}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRefreshAccount(fail.connectionId, provider);
                        }}
                        className="flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-700 hover:bg-amber-500/30 dark:text-amber-300"
                      >
                        <span className="material-symbols-outlined text-[12px]">
                          refresh
                        </span>
                        Retry
                      </button>
                    </div>
                    <span className="break-words text-[10px] text-text-muted">
                      {fail.error}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expanded Accordion: Compact List of Accounts */}
      {isExpanded && (
        <div
          id={`provider-group-${provider}`}
          className="border-t border-black/10 bg-black/[0.01] p-3 space-y-3 dark:border-white/10 dark:bg-white/[0.01]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-primary">
              Accounts ({connections.length})
            </span>
            <span className="text-[11px] text-text-muted">
              Showing {visibleConnections.length} of {connections.length}
            </span>
          </div>

          <div className="space-y-2.5">
            {visibleConnections.map((conn) => {
              const quota = quotaData[conn.id];
              const isLoading = loading[conn.id];
              const error = errors[conn.id];
              const isInactive = conn.isActive === false;
              const isCodex = conn.provider === "codex";
              const claudeReset =
                conn.provider === "claude"
                  ? quota?.raw?.resetCredits
                  : null;
              const resetCreditCount = getCodexResetCreditCount(quota);
              const isResettingLimit = resettingLimitId === conn.id;
              const rowBusy =
                deletingId === conn.id ||
                togglingId === conn.id ||
                isResettingLimit;
              const rawQuotas = quota?.quotas || [];
              const visibleQuotas = filterQuotasByVisibility(
                conn.provider,
                rawQuotas,
                quotaVisibility,
              );
              const hiddenQuotaRows = getHiddenQuotaRows(
                conn.provider,
                rawQuotas,
                quotaVisibility,
              );

              const hasAccountError =
                Boolean(error) ||
                (Boolean(quota?.message) && visibleQuotas.length === 0);
              const accountErrorText = error || quota?.message;

              return (
                <div
                  key={conn.id}
                  className={`rounded-xl border border-black/10 bg-surface p-2.5 shadow-sm dark:border-white/10 ${
                    isInactive ? "opacity-60" : ""
                  }`}
                >
                  {/* Account Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-black/5 pb-2 dark:border-white/5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-text-primary truncate">
                          {getConnectionLabel(conn) || "Account"}
                        </span>
                        {isInactive && (
                          <span className="rounded bg-black/5 px-1.5 py-0.2 text-[9px] font-medium text-text-muted dark:bg-white/10">
                            off
                          </span>
                        )}
                      </div>
                      {getConnectionSecondaryLabel(conn) && (
                        <p className="text-[10px] text-text-muted truncate">
                          {getConnectionSecondaryLabel(conn)}
                        </p>
                      )}
                      {conn.provider === "kiro" && (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[9px] font-semibold text-brand-600 dark:text-brand-300">
                            {kiroMethodLabel(conn)}
                          </span>
                          {kiroRegion(conn) && (
                            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[9px] font-semibold text-blue-600 dark:text-blue-400">
                              {kiroRegion(conn)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Account Controls */}
                    <div className="flex shrink-0 items-center gap-1">
                      {/* Retry Button if this account has an error */}
                      {hasAccountError && (
                        <button
                          type="button"
                          onClick={() =>
                            onRefreshAccount(conn.id, conn.provider)
                          }
                          disabled={isLoading || rowBusy}
                          className="flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-500/20 disabled:opacity-50 dark:text-amber-300"
                          title="Retry fetching quota for this account"
                        >
                          <span
                            className={`material-symbols-outlined text-[14px] ${
                              isLoading ? "animate-spin" : ""
                            }`}
                          >
                            refresh
                          </span>
                          <span>Retry</span>
                        </button>
                      )}

                      {/* Codex / Claude reset credits */}
                      {(isCodex || conn.provider === "claude") && (
                        <>
                          <Tooltip
                            text={
                              isCodex
                                ? `Reset Codex 5h limit (${resetCreditCount} credits left)`
                                : `Reset Claude limits (${resetCreditCount} resets left)`
                            }
                          >
                            <button
                              type="button"
                              onClick={() =>
                                onResetCodexLimit(conn, resetCreditCount)
                              }
                              disabled={
                                isLoading || rowBusy || resetCreditCount <= 0
                              }
                              aria-label={
                                isCodex
                                  ? "Reset Codex 5h limit"
                                  : "Reset Claude limits"
                              }
                              className={`flex h-7 items-center gap-1 rounded-md border border-black/10 px-1.5 text-[11px] transition-colors hover:bg-black/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5 ${
                                resetCreditCount > 0
                                  ? "text-primary font-semibold"
                                  : "text-text-muted"
                              }`}
                            >
                              <span
                                className={`material-symbols-outlined text-[14px] ${
                                  isResettingLimit ? "animate-spin" : ""
                                }`}
                              >
                                {isResettingLimit
                                  ? "progress_activity"
                                  : "restart_alt"}
                              </span>
                              <span>{resetCreditCount}</span>
                            </button>
                          </Tooltip>
                          <Tooltip
                            text={
                              isCodex
                                ? "View Codex reset credit expiry"
                                : "View Claude Code reset expiry"
                            }
                          >
                            <button
                              type="button"
                              onClick={() =>
                                isCodex
                                  ? onViewCodexResetCredits(conn)
                                  : onViewClaudeResets(conn, claudeReset)
                              }
                              disabled={isLoading || rowBusy}
                              aria-label="View reset credit expiry"
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-black/10 text-text-muted transition-colors hover:bg-black/5 hover:text-primary disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5"
                            >
                              <span className="material-symbols-outlined text-[15px]">
                                schedule
                              </span>
                            </button>
                          </Tooltip>
                        </>
                      )}

                      {/* Auto Ping */}
                      {AUTO_PING_SETTINGS_KEYS[conn.provider] &&
                        conn.authType === "oauth" && (
                          <Tooltip text={AUTO_PING_TOOLTIPS[conn.provider]}>
                            <button
                              type="button"
                              onClick={() =>
                                toggleAutoPing(
                                  conn.id,
                                  conn.provider,
                                  !(
                                    autoPingMaps[conn.provider]?.[conn.id] ===
                                    true
                                  ),
                                )
                              }
                              aria-label="Toggle auto-ping"
                              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${
                                autoPingMaps[conn.provider]?.[conn.id] === true
                                  ? "text-primary"
                                  : "text-text-muted"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                bolt
                              </span>
                            </button>
                          </Tooltip>
                        )}

                      {/* Refresh Account */}
                      <Tooltip text="Refresh quota">
                        <button
                          type="button"
                          onClick={() =>
                            onRefreshAccount(conn.id, conn.provider)
                          }
                          disabled={isLoading || rowBusy}
                          aria-label="Refresh quota"
                          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                        >
                          <span
                            className={`material-symbols-outlined text-[16px] text-text-muted ${
                              isLoading ? "animate-spin" : ""
                            }`}
                          >
                            refresh
                          </span>
                        </button>
                      </Tooltip>

                      {/* Edit Connection */}
                      <Tooltip text="Edit connection">
                        <button
                          type="button"
                          onClick={() => onEditConnection(conn)}
                          disabled={rowBusy}
                          aria-label="Edit connection"
                          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-text-muted hover:text-primary transition-colors disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            edit
                          </span>
                        </button>
                      </Tooltip>

                      {/* Delete Connection */}
                      <Tooltip text="Delete connection">
                        <button
                          type="button"
                          onClick={() => onDeleteConnection(conn.id)}
                          disabled={rowBusy}
                          aria-label="Delete connection"
                          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-red-500/10 text-red-500 transition-colors disabled:opacity-50"
                        >
                          <span
                            className={`material-symbols-outlined text-[16px] ${
                              deletingId === conn.id ? "animate-pulse" : ""
                            }`}
                          >
                            delete
                          </span>
                        </button>
                      </Tooltip>

                      {/* Toggle Active */}
                      <div
                        className="inline-flex items-center pl-0.5"
                        title={
                          (conn.isActive ?? true)
                            ? "Disable connection"
                            : "Enable connection"
                        }
                      >
                        <Toggle
                          size="sm"
                          checked={conn.isActive ?? true}
                          disabled={rowBusy}
                          onChange={(nextActive) =>
                            onToggleAccountActive(conn.id, nextActive)
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Account Quota Display */}
                  <div className="pt-2">
                    {isLoading ? (
                      <div className="text-center py-3 text-text-muted">
                        <span className="material-symbols-outlined text-[22px] animate-spin">
                          progress_activity
                        </span>
                      </div>
                    ) : hasAccountError ? (
                      <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-2 text-xs text-red-600 dark:text-red-400">
                        <span className="material-symbols-outlined shrink-0 text-[18px]">
                          error
                        </span>
                        <span className="min-w-0 flex-1 break-words">
                          {accountErrorText}
                        </span>
                      </div>
                    ) : (
                      <QuotaTable
                        quotas={visibleQuotas}
                        compact
                        sortMode="default"
                        showSortLabel={
                          conn.provider === "codex" &&
                          quotaSortMode !== "default"
                        }
                        onHideQuota={(quotaRow) =>
                          onHideQuota(conn.provider, quotaRow)
                        }
                      />
                    )}

                    {hiddenQuotaRows.length > 0 && (
                      <div className="mt-2 flex min-w-0 items-center gap-1 border-t border-black/5 pt-1.5 text-[10px] text-text-muted dark:border-white/5">
                        <span className="material-symbols-outlined shrink-0 text-[14px]">
                          visibility_off
                        </span>
                        <span className="shrink-0">Hidden:</span>
                        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap">
                          {hiddenQuotaRows.map((quotaRow) => (
                            <button
                              key={quotaRow.modelKey || quotaRow.name}
                              type="button"
                              onClick={() =>
                                onShowQuota(conn.provider, quotaRow)
                              }
                              className="shrink-0 rounded border border-black/10 px-1 py-0.5 transition-colors hover:bg-black/5 hover:text-text-primary dark:border-white/10 dark:hover:bg-white/5"
                              title="Show this quota row"
                            >
                              {quotaRow.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Show more button if there are many accounts in this provider */}
          {hasMoreAccounts && (
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() =>
                  setDisplayCount((prev) =>
                    Math.min(prev + INITIAL_DISPLAY_COUNT, connections.length),
                  )
                }
                className="rounded-lg border border-black/10 bg-black/[0.02] px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-black/5 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/10"
              >
                Show more ({connections.length - displayCount} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
