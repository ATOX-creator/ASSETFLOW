"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Boxes, Layers, RefreshCw, ScanLine } from "lucide-react";
import { useApp } from "@/lib/i18n";
import { apiGet, errorMessage } from "@/lib/api/client";
import type { DashboardResponse } from "@/lib/api/types";
import { categoryIcon, TONE_BADGE, TONE_DOT, toneOf } from "@/lib/visuals";
import { useDataRefresh } from "@/lib/dataRefresh";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateBlocks";
import AssetAnalytics from "@/components/AssetAnalytics";

export default function DashboardPage() {
  const { t, tStatus, tCategory, formatDate } = useApp();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const versionRef = useRef(0);

  const load = useCallback(
    async (signal?: AbortSignal, options?: { silent?: boolean }) => {
      const version = ++versionRef.current;
      if (!options?.silent) {
        setLoading(true);
      }
      setRefreshing(true);
      setError(null);
      try {
        const payload = await apiGet<DashboardResponse>("/api/dashboard", signal);
        if (signal?.aborted || version !== versionRef.current) {
          return;
        }
        setData(payload);
      } catch (reason) {
        if (signal?.aborted || version !== versionRef.current) {
          return;
        }
        setError(errorMessage(reason, t("errors.loadFailed")));
      } finally {
        if (!signal?.aborted && version === versionRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [t],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useDataRefresh(() => {
    void load(undefined, { silent: true });
  });

  useEffect(() => {
    const onFocus = (): void => {
      void load(undefined, { silent: true });
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  if (loading && !data) {
    return <LoadingBlock label={t("common.loadingData")} />;
  }

  if (error && !data) {
    return <ErrorBlock message={error} retryLabel={t("common.retry")} onRetry={() => void load()} />;
  }

  const stats = data ?? { total: 0, byStatus: [], byCategory: [], recent: [] };

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
      <div>
        <p className="eyebrow">{t("dashboard.title")}</p>
        <p className="mt-1 text-sm text-muted">{t("dashboard.subtitle")}</p>
      </div>

      {error && data && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
          <button type="button" className="btn-ghost" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t("common.retry")}
          </button>
        </div>
      )}

      {data && (
        <AssetAnalytics
          data={data}
          refreshing={refreshing}
          onRefresh={() => void load(undefined, { silent: true })}
        />
      )}

      <section aria-labelledby="summary-heading" className="panel overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line/40 bg-header px-5 py-4">
          <div>
            <p className="eyebrow">{t("dashboard.summary")}</p>
            <h2 id="summary-heading" className="text-sm font-semibold text-ink">
              {t("dashboard.totalAssets")}
            </h2>
          </div>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            {stats.total} {t("dashboard.assets")}
          </span>
        </header>

        <div className="grid grid-cols-2 gap-px bg-line/30 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <Link
            href="/assets"
            className="flex flex-col justify-between gap-3 bg-panel p-4 transition-colors hover:bg-header"
          >
            <span className="eyebrow">{t("dashboard.totalAssets")}</span>
            <span className="font-mono text-3xl font-semibold tracking-tight text-accent">
              {stats.total}
            </span>
          </Link>

          {stats.byStatus.map((entry) => {
            const Icon = Layers;
            return (
              <Link
                key={entry.status}
                href={`/assets?status=${encodeURIComponent(entry.status)}`}
                className="group flex flex-col justify-between gap-3 bg-panel p-4 transition-colors hover:bg-header"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[toneOf(entry.status)]}`}
                    aria-hidden="true"
                  />
                  <span className="truncate text-xs font-medium text-muted group-hover:text-ink">
                    {tStatus(entry.status)}
                  </span>
                </span>
                <span className="flex items-end justify-between gap-2">
                  <span className="font-mono text-2xl font-semibold tracking-tight text-ink">
                    {entry.count}
                  </span>
                  <Icon className="h-3.5 w-3.5 text-faint" aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="category-heading" className="panel overflow-hidden">
          <header className="border-b border-line/40 bg-header px-5 py-4">
            <p className="eyebrow">{t("dashboard.byCategory")}</p>
            <h2 id="category-heading" className="text-sm font-semibold text-ink">
              {t("dashboard.byCategoryHint")}
            </h2>
          </header>

          {stats.byCategory.length === 0 ? (
            <EmptyBlock title={t("dashboard.noCategories")} hint={t("dashboard.noCategoriesHint")} />
          ) : (
            <ul className="divide-y divide-line/30">
              {stats.byCategory.map((entry) => {
                const Icon = categoryIcon(entry.category);
                const share = stats.total > 0 ? (entry.count / stats.total) * 100 : 0;
                return (
                  <li key={entry.category}>
                    <Link
                      href={`/assets?category=${encodeURIComponent(entry.category)}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-header"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line/40 bg-inset text-muted">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-sm text-ink">
                            {tCategory(entry.category)}
                          </span>
                          <span className="font-mono text-sm font-semibold text-ink">
                            {entry.count}
                          </span>
                        </span>
                        <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-line/40">
                          <span
                            className="block h-full rounded-full bg-accent"
                            style={{ width: `${Math.max(share, 4)}%` }}
                          />
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="status-heading" className="panel overflow-hidden">
          <header className="border-b border-line/40 bg-header px-5 py-4">
            <p className="eyebrow">{t("dashboard.statusOverview")}</p>
            <h2 id="status-heading" className="text-sm font-semibold text-ink">
              {t("dashboard.statusOverviewHint")}
            </h2>
          </header>

          <ul className="divide-y divide-line/30">
            {stats.byStatus.map((entry) => (
              <li key={entry.status}>
                <Link
                  href={`/assets?status=${encodeURIComponent(entry.status)}`}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-header"
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[toneOf(entry.status)]}`}
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate text-sm text-ink">
                    {tStatus(entry.status)}
                  </span>
                  <span className="font-mono text-sm font-semibold text-ink">{entry.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="recent-heading" className="panel overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line/40 bg-header px-5 py-4">
          <div>
            <p className="eyebrow">{t("dashboard.recentScans")}</p>
            <h2 id="recent-heading" className="text-sm font-semibold text-ink">
              {t("dashboard.recentScansHint")}
            </h2>
          </div>
          <Link href="/log" className="btn-ghost">
            {t("common.viewAll")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </header>

        {stats.recent.length === 0 ? (
          <EmptyBlock title={t("dashboard.noScans")} hint={t("dashboard.noScansHint")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <caption className="sr-only">{t("dashboard.recentScans")}</caption>
              <thead>
                <tr className="bg-panel">
                  <th scope="col" className="eyebrow px-5 py-3">
                    {t("common.asset")}
                  </th>
                  <th scope="col" className="eyebrow px-5 py-3">
                    {t("common.assetTag")}
                  </th>
                  <th scope="col" className="eyebrow px-5 py-3">
                    {t("common.categoryName")}
                  </th>
                  <th scope="col" className="eyebrow px-5 py-3">
                    {t("common.statusName")}
                  </th>
                  <th scope="col" className="eyebrow px-5 py-3">
                    {t("common.date")}
                  </th>
                  <th scope="col" className="eyebrow px-5 py-3">
                    {t("common.time")}
                  </th>
                  <th scope="col" className="eyebrow px-5 py-3">
                    {t("common.scannedBy")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((log) => {
                  const Icon = categoryIcon(log.category);
                  return (
                    <tr key={log.id} className="border-t border-line/30">
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
                        <span className={`badge ${TONE_BADGE[toneOf(log.status)]}`}>
                          {tStatus(log.status)}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-[12px] text-muted">
                        {formatDate(log.scannedAt, "date")}
                      </td>
                      <td className="px-5 py-3 font-mono text-[12px] text-muted">
                        {formatDate(log.scannedAt, "time")}
                      </td>
                      <td className="px-5 py-3 text-[13px] text-muted">
                        <span className="flex items-center gap-2">
                          <span className="grid h-6 w-6 place-items-center rounded-full border border-line/50 bg-inset font-mono text-[9px] font-semibold text-accent">
                            {log.scannedByName
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((part) => part[0]?.toUpperCase() ?? "")
                              .join("")}
                          </span>
                          {log.scannedByName}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line/40 bg-header px-5 py-3">
          <span className="eyebrow">
            <ScanLine className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />
            {t("dashboard.scanCount", { count: stats.recent.length })}
          </span>
          <span className="eyebrow">
            <Boxes className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />
            {stats.total} {t("dashboard.assets")}
          </span>
        </footer>
      </section>
    </div>
  );
}
