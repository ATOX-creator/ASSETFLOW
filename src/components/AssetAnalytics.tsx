"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Boxes, History, RefreshCw, Search } from "lucide-react";
import { useApp } from "@/lib/i18n";
import { apiGet, errorMessage } from "@/lib/api/client";
import type {
  AssetsResponse,
  DashboardResponse,
  LogOptionsResponse,
  LogsResponse,
} from "@/lib/api/types";
import type { AssetRecord, AssetLogRecord } from "@/lib/data";
import { ASSET_CATEGORIES, ASSET_STATUSES } from "@/lib/constants";
import { categoryIcon, TONE_BADGE, TONE_DOT, toneOf } from "@/lib/visuals";
import DonutChart from "@/components/DonutChart";
import { EmptyBlock } from "@/components/StateBlocks";

interface Props {
  data: DashboardResponse;
  refreshing: boolean;
  onRefresh: () => void;
}

interface ActivityState {
  scans: number;
  uniqueAssets: number;
  lastScannedAt: string | null;
}

const HISTORY_LIMIT = 5;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function AssetAnalytics({ data, refreshing, onRefresh }: Props) {
  const { t, tStatus, tCategory, formatDate } = useApp();
  const router = useRouter();

  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activityUser, setActivityUser] = useState("");
  const [activityFrom, setActivityFrom] = useState("");
  const [activityTo, setActivityTo] = useState("");
  const [activity, setActivity] = useState<ActivityState | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [userOptions, setUserOptions] = useState<LogOptionsResponse["users"]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<AssetRecord[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AssetRecord | null>(null);
  const [history, setHistory] = useState<AssetLogRecord[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const debouncedSearch = useDebounced(searchQuery, 300);

  useEffect(() => {
    const controller = new AbortController();
    apiGet<LogOptionsResponse>("/api/logs/options", controller.signal)
      .then((payload) => {
        if (!controller.signal.aborted) {
          setUserOptions(payload.users);
        }
      })
      .catch(() => {
        // The user filter stays empty; charts do not depend on it.
      });
    return () => controller.abort();
  }, [data.generatedAt]);

  const goToLog = useCallback(
    (params: Record<string, string>) => {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value) {
          search.set(key, value);
        }
      }
      const query = search.toString();
      router.push(query ? `/log?${query}` : "/log");
    },
    [router],
  );

  useEffect(() => {
    const controller = new AbortController();
    const loadActivity = async () => {
      setActivityLoading(true);
      setActivityError(null);
      try {
        const params = new URLSearchParams();
        if (activityUser) params.set("user", activityUser);
        if (activityFrom) params.set("from", activityFrom);
        if (activityTo) params.set("to", activityTo);
        params.set("pageSize", "100");
        const payload = await apiGet<LogsResponse>(
          `/api/logs?${params.toString()}`,
          controller.signal,
        );
        if (controller.signal.aborted) {
          return;
        }
        const unique = new Set(payload.items.map((log) => log.assetId));
        setActivity({
          scans: payload.total,
          uniqueAssets: unique.size,
          lastScannedAt: payload.items[0]?.scannedAt ?? null,
        });
      } catch (reason) {
        if (controller.signal.aborted) {
          return;
        }
        setActivityError(errorMessage(reason, t("errors.loadFailed")));
      } finally {
        if (!controller.signal.aborted) {
          setActivityLoading(false);
        }
      }
    };
    void loadActivity();
    return () => controller.abort();
  }, [activityFrom, activityTo, activityUser, data.generatedAt, t]);

  useEffect(() => {
    const controller = new AbortController();
    const term = debouncedSearch.trim();
    if (!term) {
      setResults(null);
      setSearchError(null);
      setSearchLoading(false);
      return () => controller.abort();
    }
    setSearchLoading(true);
    setSearchError(null);
    const params = new URLSearchParams();
    params.set("search", term);
    if (categoryFilter) params.set("category", categoryFilter);
    if (statusFilter) params.set("status", statusFilter);
    apiGet<AssetsResponse>(`/api/assets?${params.toString()}`, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) {
          return;
        }
        setResults(payload.items.slice(0, 8));
        setSelected((current) => {
          if (!current) {
            return current;
          }
          return payload.items.find((asset) => asset.id === current.id) ?? current;
        });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setSearchError(errorMessage(reason, t("errors.loadFailed")));
        setResults(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setSearchLoading(false);
        }
      });
    return () => controller.abort();
  }, [categoryFilter, debouncedSearch, statusFilter, t]);

  useEffect(() => {
    if (!selected) {
      setHistory(null);
      return;
    }
    const controller = new AbortController();
    setHistoryLoading(true);
    const params = new URLSearchParams();
    params.set("asset", selected.id);
    params.set("pageSize", String(HISTORY_LIMIT));
    apiGet<LogsResponse>(`/api/logs?${params.toString()}`, controller.signal)
      .then((payload) => {
        if (!controller.signal.aborted) {
          setHistory(payload.items);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setHistory(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setHistoryLoading(false);
        }
      });
    return () => controller.abort();
  }, [selected]);

  const globalSlices = useMemo(
    () =>
      data.byStatus
        .filter((entry) => entry.count > 0)
        .map((entry) => ({
          key: entry.status,
          label: tStatus(entry.status),
          value: entry.count,
          tone: toneOf(entry.status),
        })),
    [data.byStatus, tStatus],
  );

  const categoryRows = useMemo(
    () =>
      data.byCategoryStatus
        .filter((row) => !categoryFilter || row.category === categoryFilter)
        .map((row) => ({
          ...row,
          slices: row.byStatus
            .filter((entry) => entry.count > 0)
            .map((entry) => ({
              key: entry.status,
              label: tStatus(entry.status),
              value: entry.count,
              tone: toneOf(entry.status),
            })),
        })),
    [categoryFilter, data.byCategoryStatus, tStatus],
  );

  const globalTotal = globalSlices.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <section aria-labelledby="analytics-heading" className="panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line/40 bg-header px-5 py-4">
        <div>
          <p className="eyebrow">{t("analytics.title")}</p>
          <h2 id="analytics-heading" className="text-sm font-semibold text-ink">
            {t("analytics.subtitle")}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-muted">
            {t("analytics.lastUpdated", { time: formatDate(data.generatedAt, "time") })}
          </span>
          <button
            type="button"
            className="btn-ghost"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {refreshing ? t("analytics.refreshing") : t("analytics.refresh")}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-end gap-3 border-b border-line/40 px-5 py-4">
        <label className="flex min-w-[160px] flex-col gap-1.5">
          <span className="eyebrow">{t("analytics.filterCategory")}</span>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            aria-label={t("analytics.filterCategory")}
            className="field cursor-pointer"
          >
            <option value="">{t("common.allCategories")}</option>
            {ASSET_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {tCategory(category)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[160px] flex-col gap-1.5">
          <span className="eyebrow">{t("analytics.filterStatus")}</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label={t("analytics.filterStatus")}
            className="field cursor-pointer"
          >
            <option value="">{t("common.allStatuses")}</option>
            {ASSET_STATUSES.map((status) => (
              <option key={status} value={status}>
                {tStatus(status)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[160px] flex-col gap-1.5">
          <span className="eyebrow">{t("analytics.filterUser")}</span>
          <select
            value={activityUser}
            onChange={(event) => setActivityUser(event.target.value)}
            aria-label={t("analytics.filterUser")}
            className="field cursor-pointer"
          >
            <option value="">{t("analytics.allUsers")}</option>
            {userOptions.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">{t("common.from")}</span>
          <input
            type="date"
            value={activityFrom}
            onChange={(event) => setActivityFrom(event.target.value)}
            aria-label={t("common.from")}
            className="field"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">{t("common.to")}</span>
          <input
            type="date"
            value={activityTo}
            onChange={(event) => setActivityTo(event.target.value)}
            aria-label={t("common.to")}
            className="field"
          />
        </label>
      </div>

      <div className="xl:grid xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="xl:border-r xl:border-line/40">
          <div className="grid gap-px bg-line/20 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] xl:grid-cols-1">
            <div className="flex flex-col items-center gap-4 bg-panel px-5 py-6">
          <DonutChart
            data={globalSlices}
            size={230}
            centerValue={globalTotal}
            centerLabel={t("analytics.centerTotal")}
            emptyLabel={t("analytics.noAssets")}
            ariaLabel={t("analytics.globalTitle")}
            onSelect={(key) => goToLog({ status: key })}
            emphasisKey={statusFilter || null}
          />
          <p className="max-w-[240px] text-center text-xs text-muted">
            {t("analytics.globalHint")}
          </p>
        </div>

        <div className="bg-panel px-5 py-6">
          <p className="eyebrow">{t("analytics.globalTitle")}</p>
          {globalSlices.length === 0 ? (
            <EmptyBlock
              title={t("analytics.noAssets")}
              hint={t("analytics.noAssetsHint")}
            />
          ) : (
            <ul className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {globalSlices.map((slice) => (
                <li key={slice.key}>
                  <button
                    type="button"
                    onClick={() => goToLog({ status: slice.key })}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-header ${
                      statusFilter && statusFilter !== slice.key ? "opacity-40" : ""
                    }`}
                  >
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[slice.tone]}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">
                      {slice.label}
                    </span>
                    <span className="font-mono text-sm font-semibold text-ink">
                      {slice.value}
                    </span>
                    <span className="font-mono text-[11px] text-faint">
                      {globalTotal > 0
                        ? `${Math.round((slice.value / globalTotal) * 100)}%`
                        : "—"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        </div>
        </div>

      <div className="border-t border-line/40 px-5 py-5 xl:border-t-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="eyebrow">{t("analytics.byCategoryTitle")}</p>
            <p className="mt-1 text-sm text-muted">{t("analytics.byCategoryHint")}</p>
          </div>
          {categoryFilter && (
            <button type="button" className="btn-ghost" onClick={() => setCategoryFilter("")}>
              {t("assets.clearFilters")}
            </button>
          )}
        </div>

        {categoryRows.length === 0 ? (
          <EmptyBlock
            title={t("analytics.noAssets")}
            hint={t("analytics.noAssetsHint")}
          />
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {categoryRows.map((row) => {
              const Icon = categoryIcon(row.category);
              return (
                <li
                  key={row.category}
                  className="flex flex-col gap-3 rounded-2xl border border-line/40 bg-inset px-4 py-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line/40 bg-panel text-muted">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <button
                      type="button"
                      onClick={() => goToLog({ category: row.category })}
                      className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-ink transition-colors hover:text-accent"
                    >
                      {tCategory(row.category)}
                    </button>
                    <span className="font-mono text-xs text-muted">
                      {t("analytics.categoryTotal", { count: row.total })}
                    </span>
                  </div>

                  <div className="flex justify-center">
                    <DonutChart
                      data={row.slices}
                      size={150}
                      thickness={18}
                      centerValue={row.total}
                      emptyLabel={t("analytics.noAssets")}
                      ariaLabel={`${tCategory(row.category)} — ${t("analytics.byCategoryTitle")}`}
                      onSelect={(key) =>
                        goToLog({ category: row.category, status: key })
                      }
                      emphasisKey={statusFilter || null}
                    />
                  </div>

                  <ul className="flex flex-wrap gap-1.5">
                    {row.slices.map((slice) => (
                      <li key={slice.key}>
                        <button
                          type="button"
                          onClick={() =>
                            goToLog({ category: row.category, status: slice.key })
                          }
                          className={`badge ${TONE_BADGE[slice.tone]} transition-opacity hover:opacity-80 ${
                            statusFilter && statusFilter !== slice.key ? "opacity-40" : ""
                          }`}
                        >
                          {slice.label} · {slice.value}
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      </div>

      <div className="grid gap-px border-t border-line/40 bg-line/20 lg:grid-cols-2">
        <div className="bg-panel px-5 py-5">
          <p className="eyebrow">{t("analytics.inspectorTitle")}</p>
          <p className="mt-1 text-sm text-muted">{t("analytics.inspectorHint")}</p>

          <div className="relative mt-4">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("analytics.searchPlaceholder")}
              aria-label={t("analytics.searchPlaceholder")}
              className="field pl-9"
            />
          </div>

          {searchError && (
            <p role="alert" className="mt-3 text-xs text-danger">
              {searchError}
            </p>
          )}

          {searchLoading && (
            <p className="mt-3 text-xs text-muted" role="status">
              {t("common.loading")}
            </p>
          )}

          {!searchLoading && debouncedSearch.trim() && results && results.length === 0 && (
            <p className="mt-3 text-sm text-muted">{t("analytics.searchEmpty")}</p>
          )}

          {results && results.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1">
              {results.map((asset) => (
                <li key={asset.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(asset)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
                      selected?.id === asset.id
                        ? "border-accent/50 bg-accent-soft"
                        : "border-transparent hover:bg-header"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {asset.name}
                      </span>
                      <span className="block font-mono text-[11px] text-accent">
                        {asset.tag}
                      </span>
                    </span>
                    <span className={`badge ${TONE_BADGE[toneOf(asset.status)]}`}>
                      {tStatus(asset.status)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!selected && !searchLoading && (
            <p className="mt-4 text-xs text-faint">{t("analytics.selectAsset")}</p>
          )}

          {selected && (
            <div className="mt-4 rounded-2xl border border-line/40 bg-inset px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{selected.name}</p>
                  <p className="font-mono text-[12px] text-accent">{selected.tag}</p>
                </div>
                <span className={`badge ${TONE_BADGE[toneOf(selected.status)]}`}>
                  {tStatus(selected.status)}
                </span>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <dt className="eyebrow">{t("common.categoryName")}</dt>
                  <dd className="mt-0.5 text-ink">{tCategory(selected.category)}</dd>
                </div>
                <div>
                  <dt className="eyebrow">{t("analytics.location")}</dt>
                  <dd className="mt-0.5 text-ink">{selected.location || t("common.none")}</dd>
                </div>
                <div>
                  <dt className="eyebrow">{t("common.date")}</dt>
                  <dd className="mt-0.5 font-mono text-ink">
                    {formatDate(selected.createdAt, "date")}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">{t("analytics.lastScanned")}</dt>
                  <dd className="mt-0.5 font-mono text-ink">
                    {selected.lastScannedAt
                      ? formatDate(selected.lastScannedAt, "datetime")
                      : t("common.none")}
                  </dd>
                </div>
              </dl>

              <div className="mt-3 border-t border-line/40 pt-3">
                <p className="eyebrow flex items-center gap-1.5">
                  <History className="h-3 w-3" aria-hidden="true" />
                  {t("analytics.recentHistory")}
                </p>
                {historyLoading && (
                  <p className="mt-2 text-xs text-muted">{t("common.loading")}</p>
                )}
                {!historyLoading && history && history.length === 0 && (
                  <p className="mt-2 text-xs text-faint">{t("analytics.noHistory")}</p>
                )}
                {history && history.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {history.map((log) => (
                      <li
                        key={log.id}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="truncate text-muted">
                          {formatDate(log.scannedAt, "datetime")} · {log.scannedByName}
                        </span>
                        <span className={`badge ${TONE_BADGE[toneOf(log.status)]}`}>
                          {tStatus(log.status)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href={`/log?asset=${encodeURIComponent(selected.id)}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
                >
                  {t("analytics.viewHistory")}
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="bg-panel px-5 py-5">
          <p className="eyebrow">{t("analytics.activityTitle")}</p>
          <p className="mt-1 text-sm text-muted">{t("analytics.activityHint")}</p>

          {activityError && (
            <p role="alert" className="mt-3 text-xs text-danger">
              {activityError}
            </p>
          )}

          {activityLoading && !activity && (
            <p className="mt-4 text-xs text-muted" role="status">
              {t("common.loadingData")}
            </p>
          )}

          {activity && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-line/40 bg-inset px-4 py-4 text-center">
                <p className="font-mono text-2xl font-semibold text-ink">
                  {activity.scans}
                </p>
                <p className="eyebrow mt-1">{t("analytics.activityScans")}</p>
              </div>
              <div className="rounded-2xl border border-line/40 bg-inset px-4 py-4 text-center">
                <p className="font-mono text-2xl font-semibold text-ink">
                  {activity.uniqueAssets}
                </p>
                <p className="eyebrow mt-1">{t("analytics.activityUnique")}</p>
              </div>
              <div className="rounded-2xl border border-line/40 bg-inset px-4 py-4 text-center">
                <p className="font-mono text-sm font-semibold text-ink">
                  {activity.lastScannedAt
                    ? formatDate(activity.lastScannedAt, "time")
                    : "—"}
                </p>
                <p className="eyebrow mt-1">{t("analytics.activityLast")}</p>
              </div>
            </div>
          )}

          {activity && activity.scans === 0 && !activityLoading && (
            <p className="mt-3 text-sm text-muted">{t("analytics.activityNone")}</p>
          )}

          <button
            type="button"
            className="btn-ghost mt-4"
            onClick={() =>
              goToLog({
                user: activityUser,
                from: activityFrom,
                to: activityTo,
              })
            }
          >
            <Boxes className="h-4 w-4" aria-hidden="true" />
            {t("analytics.viewInLog")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
