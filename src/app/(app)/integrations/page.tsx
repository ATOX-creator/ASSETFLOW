"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Blocks,
  Cloud,
  KeyRound,
  Network,
  ShieldCheck,
  X,
} from "lucide-react";
import { useApp } from "@/lib/i18n";

interface ConfigureDialogProps {
  open: boolean;
  onClose: () => void;
}

function ConfigureDialog({ open, onClose }: ConfigureDialogProps) {
  const { t } = useApp();
  const dialogRef = useRef<HTMLDivElement>(null);

  const [tenantId, setTenantId] = useState("");
  const [clientId, setClientId] = useState("");
  const [secretReference, setSecretReference] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const handleClose = useCallback(() => {
    setTenantId("");
    setClientId("");
    setSecretReference("");
    onClose();
  }, [onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="graph-dialog-title"
        tabIndex={-1}
        className="flex max-h-[95vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-line/50 bg-panel text-ink shadow-2xl focus:outline-none sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line/40 bg-header px-5 py-4">
          <div className="min-w-0">
            <p className="eyebrow">{t("integrations.dialogEyebrow")}</p>
            <h2 id="graph-dialog-title" className="text-sm font-semibold text-ink">
              {t("integrations.dialogTitle")}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label={t("common.close")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line/50 text-muted transition-colors hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-5">
          <p className="flex items-start gap-2 rounded-xl border border-line/50 bg-inset px-3 py-2.5 text-xs leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
            {t("integrations.dialogHint")}
          </p>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">{t("integrations.tenantId")}</span>
            <input
              type="text"
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
              placeholder={t("integrations.tenantIdPlaceholder")}
              autoComplete="off"
              spellCheck={false}
              className="field font-mono"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">{t("integrations.clientId")}</span>
            <input
              type="text"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              placeholder={t("integrations.clientIdPlaceholder")}
              autoComplete="off"
              spellCheck={false}
              className="field font-mono"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">{t("integrations.clientSecret")}</span>
            <input
              type="password"
              value={secretReference}
              onChange={(event) => setSecretReference(event.target.value)}
              placeholder={t("integrations.clientSecretPlaceholder")}
              autoComplete="new-password"
              spellCheck={false}
              className="field font-mono"
            />
            <span className="text-[11px] leading-relaxed text-muted">
              {t("integrations.clientSecretHint")}
            </span>
          </label>

          <div className="rounded-xl border border-line/50 bg-inset px-4 py-3">
            <p className="eyebrow">{t("integrations.connectionTitle")}</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted">
                {t("integrations.connectionStatus")}
              </span>
              <span className="badge tone-gray">
                {t("integrations.statusUnavailable")}
              </span>
            </div>
            <button
              type="button"
              disabled
              className="btn-ghost mt-3 w-full cursor-not-allowed opacity-60"
              aria-disabled="true"
            >
              <Network className="h-4 w-4" aria-hidden="true" />
              {t("integrations.testConnection")}
            </button>
          </div>

          <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-xs leading-relaxed text-warning">
            <span className="font-semibold">{t("integrations.pendingTitle")}</span>
            <br />
            {t("integrations.pendingHint")}
          </p>
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line/40 bg-header px-5 py-4">
          <button type="button" className="btn-ghost" onClick={handleClose}>
            {t("common.close")}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const { t } = useApp();
  const [configureOpen, setConfigureOpen] = useState(false);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <p className="eyebrow">{t("integrations.title")}</p>
        <p className="mt-1 text-sm text-muted">{t("integrations.subtitle")}</p>
      </div>

      <section className="panel overflow-hidden">
        <header className="flex items-center gap-3 border-b border-line/40 bg-header px-5 py-4">
          <Cloud className="h-4 w-4 text-accent" aria-hidden="true" />
          <div>
            <p className="eyebrow">{t("integrations.graphName")}</p>
            <h2 className="text-sm font-semibold text-ink">
              {t("integrations.graphHint")}
            </h2>
          </div>
        </header>

        <div className="flex flex-col gap-4 px-5 py-5">
          <p className="text-sm leading-relaxed text-muted">
            {t("integrations.graphDescription")}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line/50 bg-inset px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line/50 bg-panel text-muted">
                <KeyRound className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  {t("integrations.statusNotConfigured")}
                </p>
                <p className="truncate text-xs text-muted">
                  {t("integrations.graphStatusHint")}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setConfigureOpen(true)}
            >
              {t("integrations.configure")}
            </button>
          </div>

          <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
            <div className="flex items-center justify-between gap-2 rounded-lg px-1 py-1">
              <dt className="text-muted">{t("integrations.connectionStatus")}</dt>
              <dd>
                <span className="badge tone-gray">
                  {t("integrations.statusUnavailable")}
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg px-1 py-1">
              <dt className="text-muted">{t("integrations.lastChecked")}</dt>
              <dd className="font-mono text-muted">{t("integrations.never")}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-line/50 bg-inset text-muted">
            <Blocks className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold text-ink">
            {t("integrations.emptyTitle")}
          </p>
          <p className="max-w-sm text-xs leading-relaxed text-muted">
            {t("integrations.emptyHint")}
          </p>
        </div>
      </section>

      <ConfigureDialog
        open={configureOpen}
        onClose={() => setConfigureOpen(false)}
      />
    </div>
  );
}
