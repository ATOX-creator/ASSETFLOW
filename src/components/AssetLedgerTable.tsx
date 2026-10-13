"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Ellipsis, Search } from "lucide-react";
import { useApp } from "@/lib/i18n";
import type { AssetRecord } from "@/lib/data";
import { ASSET_CATEGORIES, ASSET_STATUSES, type AssetStatus } from "@/lib/constants";
import { categoryIcon, TONE_BADGE, TONE_DOT, toneOf } from "@/lib/visuals";

interface AssetLedgerTableProps {
  assets: AssetRecord[];
  onStatusChange: (id: string, status: AssetStatus) => void;
  initialSearch?: string;
  initialStatus?: string;
  initialCategory?: string;
  busy?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
}

export default function AssetLedgerTable({
  assets,
  onStatusChange,
  initialSearch = "",
  initialStatus = "",
  initialCategory = "",
  busy = false,
  emptyTitle,
  emptyHint,
}: AssetLedgerTableProps) {
  const { t, tStatus, tCategory, formatDate } = useApp();

  const [query, setQuery] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const filteredAssets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return assets.filter((asset) => {
      if (statusFilter && asset.status !== statusFilter) {
        return false;
      }
      if (categoryFilter && asset.category !== categoryFilter) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return (
        asset.tag.toLowerCase().includes(needle) ||
        asset.name.toLowerCase().includes(needle) ||
        asset.category.toLowerCase().includes(needle)
      );
    });
  }, [assets, categoryFilter, query, statusFilter]);

  useEffect(() => {
    if (openMenuId === null) {
      return;
    }
    const handlePointerDown = (event: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuId]);

  const selectStatus = (id: string, status: AssetStatus): void => {
    onStatusChange(id, status);
    setOpenMenuId(null);
  };

  const hasFilters = Boolean(query.trim() || statusFilter || categoryFilter);

  return (
    <section className="panel flex flex-col overflow-x-auto">
      <header className="flex min-w-[860px] flex-wrap items-center justify-between gap-3 border-b border-line/40 bg-header px-5 py-4">
        <div>
          <p className="eyebrow">{t("assets.tableTitle")}</p>
          <h2 className="text-sm font-semibold text-ink">{t("assets.tableSubtitle")}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("assets.searchPlaceholder")}
              aria-label={t("assets.searchLabel")}
              className="field w-[240px] pl-9 font-mono"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            aria-label={t("assets.categoryFilterLabel")}
            className="field w-auto cursor-pointer"
          >
            <option value="">{t("common.allCategories")}</option>
            {ASSET_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {tCategory(category)}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label={t("assets.statusFilterLabel")}
            className="field w-auto cursor-pointer"
          >
            <option value="">{t("common.allStatuses")}</option>
            {ASSET_STATUSES.map((status) => (
              <option key={status} value={status}>
                {tStatus(status)}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setQuery("");
                setStatusFilter("");
                setCategoryFilter("");
              }}
            >
              {t("assets.clearFilters")}
            </button>
          )}
        </div>
      </header>

      <div className="min-w-[860px]">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{t("assets.caption")}</caption>
          <thead>
            <tr className="bg-panel">
              <th scope="col" className="eyebrow px-5 py-3">{t("common.assetTag")}</th>
              <th scope="col" className="eyebrow px-5 py-3">{t("common.asset")}</th>
              <th scope="col" className="eyebrow px-5 py-3">{t("common.categoryName")}</th>
              <th scope="col" className="eyebrow px-5 py-3">{t("common.statusName")}</th>
              <th scope="col" className="eyebrow px-5 py-3">{t("assets.lastScan")}</th>
              <th scope="col" className="px-5 py-3">
                <span className="sr-only">{t("common.actions")}</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredAssets.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">
                    {emptyTitle ?? (hasFilters ? t("assets.empty") : t("assets.emptyAll"))}
                  </p>
                  {emptyHint && <p className="mt-2 text-sm text-muted">{emptyHint}</p>}
                </td>
              </tr>
            )}

            {filteredAssets.map((asset, index) => {
              const CategoryIcon = categoryIcon(asset.category);
              const isMenuOpen = openMenuId === asset.id;
              const isLastRow = index === filteredAssets.length - 1;

              return (
                <tr
                  key={asset.id}
                  className="border-t border-line/30 transition-colors hover:bg-header"
                >
                  <td className="max-w-[300px] px-5 py-3 font-mono text-[13px] break-all tracking-[0.04em] text-accent">
                    {asset.tag}
                  </td>
                  <td className="max-w-[280px] px-5 py-3 text-sm font-medium break-words text-ink">
                    {asset.name}
                  </td>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2 text-[13px] text-muted">
                      <CategoryIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      {tCategory(asset.category)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`badge ${TONE_BADGE[toneOf(asset.status)]}`}>
                      {tStatus(asset.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-[12px] text-muted">
                    {asset.lastScannedAt ? formatDate(asset.lastScannedAt) : "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div ref={isMenuOpen ? menuRef : undefined} className="relative inline-block">
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(isMenuOpen ? null : asset.id)}
                        aria-haspopup="menu"
                        aria-expanded={isMenuOpen}
                        aria-label={t("assets.rowActions", { tag: asset.tag })}
                        className="grid h-8 w-8 place-items-center rounded-xl border border-line/50 bg-inset text-muted transition-colors hover:border-accent/50 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <Ellipsis className="h-4 w-4" aria-hidden="true" />
                      </button>

                      {isMenuOpen && (
                        <div
                          role="menu"
                          className={`absolute right-0 z-20 max-h-72 w-56 overflow-y-auto rounded-xl border border-line/60 bg-panel py-1 shadow-[0_16px_32px_-12px_rgba(0,0,0,0.85)] ${
                            isLastRow ? "bottom-full mb-1" : "top-full mt-1"
                          }`}
                        >
                          {ASSET_STATUSES.map((status) => (
                            <button
                              key={status}
                              type="button"
                              role="menuitem"
                              onClick={() => selectStatus(asset.id, status)}
                              aria-label={t("assets.markStatus", { status: tStatus(status) })}
                              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-header ${
                                asset.status === status ? "text-accent" : "text-muted"
                              }`}
                            >
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[toneOf(status)]}`}
                                aria-hidden="true"
                              />
                              {tStatus(status)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="flex min-w-[860px] flex-wrap items-center justify-between gap-2 border-t border-line/40 bg-header px-5 py-3">
        <span className="eyebrow">
          {t("assets.showing", {
            count: filteredAssets.length,
            total: assets.length,
          })}
        </span>
        <span className="eyebrow">
          {busy ? t("common.saving") : t("assets.syncFooter")}
          <ChevronDown className="ml-1 inline h-3 w-3" aria-hidden="true" />
        </span>
      </footer>
    </section>
  );
}
