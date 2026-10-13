"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useApp } from "@/lib/i18n";
import { apiGet, apiSend, errorMessage } from "@/lib/api/client";
import { notifyDataChanged, useDataRefresh } from "@/lib/dataRefresh";
import type { AssetResponse, AssetsResponse } from "@/lib/api/types";
import type { AssetRecord } from "@/lib/data";
import { isAssetStatus, type AssetStatus } from "@/lib/constants";
import AssetLedgerTable from "@/components/AssetLedgerTable";
import { ErrorBlock, LoadingBlock } from "@/components/StateBlocks";

function AssetsContent() {
  const { t } = useApp();
  const searchParams = useSearchParams();

  const initialSearch = searchParams.get("search") ?? "";
  const initialStatus = searchParams.get("status") ?? "";
  const initialCategory = searchParams.get("category") ?? "";

  const [assets, setAssets] = useState<AssetRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (initialSearch) params.set("search", initialSearch);
    if (initialStatus) params.set("status", initialStatus);
    if (initialCategory) params.set("category", initialCategory);
    return params.toString();
  }, [initialCategory, initialSearch, initialStatus]);

  const load = useCallback(
    async (suffix: string, signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const payload = await apiGet<AssetsResponse>(
          `/api/assets${suffix ? `?${suffix}` : ""}`,
          signal,
        );
        if (signal?.aborted) {
          return;
        }
        setAssets(payload.items);
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
    const controller = new AbortController();
    void load(query, controller.signal);
    return () => controller.abort();
  }, [load, query]);

  useDataRefresh(() => {
    void load(query);
  });

  const handleStatusChange = useCallback(
    async (id: string, status: AssetStatus) => {
      if (!isAssetStatus(status)) {
        return;
      }
      const previous = assets;
      setAssets((current) =>
        current?.map((asset) => (asset.id === id ? { ...asset, status } : asset)) ?? current,
      );
      setSavingId(id);
      try {
        const payload = await apiSend<AssetResponse>(`/api/assets/${id}`, "PATCH", {
          status,
        });
        notifyDataChanged("asset_update");
        setAssets((current) =>
          current?.map((asset) => (asset.id === payload.asset.id ? payload.asset : asset)) ??
          current,
        );
      } catch (reason) {
        setAssets(previous);
        setError(errorMessage(reason, t("errors.generic")));
      } finally {
        setSavingId(null);
      }
    },
    [assets, t],
  );

  if (loading && !assets) {
    return <LoadingBlock label={t("common.loadingData")} />;
  }

  if (error && !assets) {
    return (
      <ErrorBlock
        message={error}
        retryLabel={t("common.retry")}
        onRetry={() => void load(query)}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{t("assets.title")}</p>
          <p className="mt-1 text-sm text-muted">{t("assets.subtitle")}</p>
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => void load(query)}
          disabled={loading}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {t("common.retry")}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <AssetLedgerTable
        assets={assets ?? []}
        onStatusChange={(id, status) => void handleStatusChange(id, status)}
        initialSearch={initialSearch}
        initialStatus={initialStatus}
        initialCategory={initialCategory}
        busy={savingId !== null}
      />
    </div>
  );
}

export default function AssetsPage() {
  const { t } = useApp();
  return (
    <Suspense fallback={<LoadingBlock label={t("common.loadingData")} />}>
      <AssetsContent />
    </Suspense>
  );
}
