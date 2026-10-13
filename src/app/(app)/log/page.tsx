"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, RefreshCw, Search, Upload } from "lucide-react";
import { useApp } from "@/lib/i18n";
import { apiGet, errorMessage } from "@/lib/api/client";
import type { LogsResponse } from "@/lib/api/types";
import { categoryIcon, TONE_BADGE, toneOf } from "@/lib/visuals";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateBlocks";
import ImportDialog from "@/components/ImportDialog";
import type { LogOptionsResponse } from "@/lib/api/types";

interface Filters {
  search: string;
  asset: string;
  category: string;
  status: string;
  user: string;
  from: string;
  to: string;
  sort: "newest" | "oldest";
}

const INITIAL_FILTERS: Filters = {
  search: "",
  asset: "",
  category: "",
  status: "",
  user: "",
  from: "",
  to: "",
  sort: "newest",
};

const PAGE_SIZE = 25;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function readInitialFilters(params: URLSearchParams): Filters {
  const sort = params.get("sort");
  return {
    search: params.get("search") ?? "",
    asset: params.get("asset") ?? "",
    category: params.get("category") ?? "",
    status: params.get("status") ?? "",
    user: params.get("user") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    sort: sort === "oldest" ? "oldest" : "newest",
  };
}

function AssetLogContent() {
  const { t, tStatus, tCategory, formatDate } = useApp();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<Filters>(() => readInitialFilters(searchParams));
  const [page, setPage] = useState(1);
  const [options, setOptions] = useState<LogOptionsResponse | null>(null);
  const [data, setData] = useState<LogsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);

  const debouncedSearch = useDebounced(filters.search, 300);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (filters.asset) params.set("asset", filters.asset);
    if (filters.category) params.set("category", filters.category);
    if (filters.status) params.set("status", filters.status);
    if (filters.user) params.set("user", filters.user);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    params.set("sort", filters.sort);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    return params.toString();
  }, [debouncedSearch, filters, page]);

  const loadOptions = useCallback(async () => {
    setOptionsError(null);
    try {
      setOptions(await apiGet<LogOptionsResponse>("/api/logs/options"));
    } catch (reason) {
      setOptionsError(errorMessage(reason, t("errors.loadFailed")));
    }
  }, [t]);

  const load = useCallback(
    async (query: string, signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const payload = await apiGet<LogsResponse>(`/api/logs?${query}`, signal);
        if (signal?.aborted) {
          return;
        }
        setData(payload);
      } catch (reason) {
        if (signal?.aborted) {
          return;
        }
        setError(errorMessage(reason, t("errors.loadFailed")));
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [t],
  );

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    const controller = new AbortController();
    void load(queryString, controller.signal);
    return () => controller.abort();
  }, [load, queryString]);

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]): void => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(1);
  };

  const clearFilters = (): void => {
    setFilters(INITIAL_FILTERS);
    setPage(1);
  };

  const hasFilters =
    filters.search.trim().length > 0 ||
    filters.asset !== "" ||
    filters.category !== "" ||
    filters.status !== "" ||
    filters.user !== "" ||
    filters.from !== "" ||
    filters.to !== "";

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const rangeFrom = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
  const rangeTo = data ? Math.min(data.page * data.pageSize, data.total) : 0;

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
      <div>
        <p className="eyebrow">{t("log.title")}</p>
        <p className="mt-1 text-sm text-muted">{t("log.subtitle")}</p>
      </div>

      <section className="panel overflow-hidden">
        <header className="border-b border-line/40 bg-header px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">{t("log.filters")}</p>
              <h2 className="text-sm font-semibold text-ink">{t("log.auditNote")}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setImportOpen(true)}
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                {t("import.title")}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => void load(queryString)}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {t("common.retry")}
              </button>
              {hasFilters && (
                <button type="button" className="btn-ghost" onClick={clearFilters}>
                  {t("assets.clearFilters")}
                </button>
              )}
            </div>
          </div>

          {optionsError && (
            <p role="alert" className="mt-3 text-xs text-danger">
              {optionsError}
            </p>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative xl:col-span-2">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <input
                type="search"
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder={t("log.searchPlaceholder")}
                aria-label={t("log.searchPlaceholder")}
                className="field pl-9"
              />
            </div>

            <select
              value={filters.asset}
              onChange={(event) => updateFilter("asset", event.target.value)}
              aria-label={t("log.filterAsset")}
              className="field cursor-pointer"
            >
              <option value="">{t("log.filterAsset")}</option>
              {options?.assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.tag} — {asset.name}
                </option>
              ))}
            </select>

            <select
              value={filters.category}
              onChange={(event) => updateFilter("category", event.target.value)}
              aria-label={t("log.filterCategory")}
              className="field cursor-pointer"
            >
              <option value="">{t("common.allCategories")}</option>
              {options?.categories.map((category) => (
                <option key={category} value={category}>
                  {tCategory(category)}
                </option>
              ))}
            </select>

            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
              aria-label={t("log.filterStatus")}
              className="field cursor-pointer"
            >
              <option value="">{t("common.allStatuses")}</option>
              {options?.statuses.map((status) => (
                <option key={status} value={status}>
                  {tStatus(status)}
                </option>
              ))}
            </select>

            <select
              value={filters.user}
              onChange={(event) => updateFilter("user", event.target.value)}
              aria-label={t("log.filterUser")}
              className="field cursor-pointer"
            >
              <option value="">{t("common.allUsers")}</option>
              {options?.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>

            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">{t("log.filterFrom")}</span>
              <input
                type="date"
                value={filters.from}
                onChange={(event) => updateFilter("from", event.target.value)}
                className="field"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">{t("log.filterTo")}</span>
              <input
                type="date"
                value={filters.to}
                onChange={(event) => updateFilter("to", event.target.value)}
                className="field"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">{t("log.sort")}</span>
              <select
                value={filters.sort}
                onChange={(event) =>
                  updateFilter("sort", event.target.value as Filters["sort"])
                }
                className="field cursor-pointer"
              >
                <option value="newest">{t("log.newest")}</option>
                <option value="oldest">{t("log.oldest")}</option>
              </select>
            </label>
          </div>
        </header>

        {loading && !data && <LoadingBlock label={t("common.loadingData")} />}

        {!loading && error && !data && (
          <ErrorBlock
            message={error}
            retryLabel={t("common.retry")}
            onRetry={() => void load(queryString)}
          />
        )}

        {error && data && (
          <div className="flex items-center justify-between gap-3 border-b border-line/40 bg-danger/10 px-5 py-3">
            <p className="text-sm text-danger">{error}</p>
            <button type="button" className="btn-ghost" onClick={() => void load(queryString)}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {t("common.retry")}
            </button>
          </div>
        )}

        {data && data.items.length === 0 && !loading && (
          <EmptyBlock
            title={hasFilters ? t("log.empty") : t("log.noFilters")}
            hint={hasFilters ? t("log.emptyHint") : t("dashboard.noScansHint")}
          />
        )}

        {data && data.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <caption className="sr-only">{t("log.title")}</caption>
              <thead>
                <tr className="bg-panel">
                  <th scope="col" className="eyebrow px-5 py-3">{t("common.asset")}</th>
                  <th scope="col" className="eyebrow px-5 py-3">{t("common.assetTag")}</th>
                  <th scope="col" className="eyebrow px-5 py-3">{t("common.categoryName")}</th>
                  <th scope="col" className="eyebrow px-5 py-3">{t("log.previousStatus")}</th>
                  <th scope="col" className="eyebrow px-5 py-3">{t("common.statusName")}</th>
                  <th scope="col" className="eyebrow px-5 py-3">{t("common.scannedBy")}</th>
                  <th scope="col" className="eyebrow px-5 py-3">{t("common.date")}</th>
                  <th scope="col" className="eyebrow px-5 py-3">{t("common.time")}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((log) => {
                  const Icon = categoryIcon(log.category);
                  return (
                    <tr key={log.id} className="border-t border-line/30 hover:bg-header">
                      <td className="px-5 py-3">
                        <Link
                          href={`/assets?search=${encodeURIComponent(log.assetTag)}`}
                          className="flex items-center gap-2 text-sm font-medium text-ink hover:text-accent"
                        >
                          <Icon className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                          <span className="truncate">{log.assetName}</span>
                        </Link>
                      </td>
                      <td className="px-5 py-3 font-mono text-[13px] break-all text-accent">
                        {log.assetTag}
                      </td>
                      <td className="px-5 py-3 text-[13px] text-muted">
                        {tCategory(log.category)}
                      </td>
                      <td className="px-5 py-3">
                        {log.previousStatus ? (
                          <span className={`badge ${TONE_BADGE[toneOf(log.previousStatus)]}`}>
                            {tStatus(log.previousStatus)}
                          </span>
                        ) : (
                          <span className="font-mono text-[11px] text-muted">
                            {t("common.none")}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`badge ${TONE_BADGE[toneOf(log.status)]}`}>
                          {tStatus(log.status)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[13px] text-muted">
                        <span className="flex items-center gap-2">
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line/50 bg-inset font-mono text-[9px] font-semibold text-accent">
                            {log.scannedByName
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((part) => part[0]?.toUpperCase() ?? "")
                              .join("")}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-ink">{log.scannedByName}</span>
                            <span className="block truncate text-[11px] text-faint">
                              {log.scannedByEmail}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-[12px] text-muted">
                        {formatDate(log.scannedAt, "date")}
                      </td>
                      <td className="px-5 py-3 font-mono text-[12px] text-muted">
                        {formatDate(log.scannedAt, "time")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > 0 && (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line/40 bg-header px-5 py-3">
            <span className="eyebrow">
              {t("log.showing", { from: rangeFrom, to: rangeTo, total: data.total })}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-ghost"
                disabled={data.page <= 1 || loading}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                {t("common.previous")}
              </button>
              <span className="font-mono text-[11px] text-muted">
                {data.page} / {totalPages}
              </span>
              <button
                type="button"
                className="btn-ghost"
                disabled={data.page >= totalPages || loading}
                onClick={() => setPage((value) => value + 1)}
              >
                {t("common.next")}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </footer>
        )}
      </section>

      <ImportDialog
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          void load(queryString);
        }}
      />
    </div>
  );
}

export default function AssetLogPage() {
  const { t } = useApp();
  return (
    <Suspense fallback={<LoadingBlock label={t("common.loadingData")} />}>
      <AssetLogContent />
    </Suspense>
  );
}
