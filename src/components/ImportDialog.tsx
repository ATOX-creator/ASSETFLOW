"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, Link2, Upload, X } from "lucide-react";
import { apiGet, apiSend, errorMessage } from "@/lib/api/client";
import type { AssetsResponse } from "@/lib/api/types";
import { useApp } from "@/lib/i18n";
import { pushToast } from "@/lib/toast";
import { notifyDataChanged } from "@/lib/dataRefresh";
import { detectColumns } from "@/lib/import/headers";
import { parseGoogleSheetUrl } from "@/lib/import/sheet";
import { validateImportRows, rowOutcome } from "@/lib/import/validate";
import type {
  ColumnDetection,
  ImportCommitResult,
  RawRow,
  ValidatedRow,
} from "@/lib/import/types";

const PREVIEW_LIMIT = 50;

type Mode = "file" | "sheet";
type Phase = "idle" | "working" | "preview" | "done";

interface Props {
  open: boolean;
  onClose: () => void;
}

function issueLabel(
  t: (key: string, vars?: Record<string, string | number>) => string,
  issue: ValidatedRow["issues"][number],
): string {
  return t(`import.issue.${issue.code}`, { value: issue.value ?? "" });
}

export default function ImportDialog({ open, onClose }: Props) {
  const { t, tStatus, tCategory } = useApp();

  const [mode, setMode] = useState<Mode>("file");
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [detection, setDetection] = useState<ColumnDetection | null>(null);
  const [validation, setValidation] = useState<{
    rows: ValidatedRow[];
    importable: ValidatedRow[];
    errorCount: number;
    warningCount: number;
  } | null>(null);
  const [commitResult, setCommitResult] = useState<ImportCommitResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);

  const busy = phase === "working";

  const reset = useCallback(() => {
    setPhase("idle");
    setFile(null);
    setSheetUrl("");
    setDragActive(false);
    setDetection(null);
    setValidation(null);
    setCommitResult(null);
    setActionError(null);
    busyRef.current = false;
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    reset();
    dialogRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, reset]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && !busyRef.current) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const processRows = useCallback(
    async (rows: RawRow[]) => {
      const { buildImportRecords } = await import("@/lib/import/parse");
      const headers = rows[0]?.cells ?? [];
      const nextDetection = detectColumns(headers);
      setDetection(nextDetection);

      if (nextDetection.missing.length > 0) {
        const columns = nextDetection.missing
          .map((field) => t(`import.fieldNames.${field}`))
          .join(", ");
        pushToast("error", t("import.missingTitle"), t("import.missingDesc", { columns }));
        setPhase("idle");
        return;
      }

      const records = buildImportRecords(rows, nextDetection);

      if (records.length === 0) {
        pushToast("error", t("import.fileEmpty"));
        setPhase("idle");
        return;
      }

      let existingTags: string[] = [];
      try {
        const payload = await apiGet<AssetsResponse>("/api/assets");
        existingTags = payload.items.map((asset) => asset.tag);
      } catch {
        // Validation continues without known tags; the server re-checks duplicates.
      }

      const result = validateImportRows(records, existingTags);
      setValidation(result);
      setPhase("preview");
    },
    [t],
  );

  const parseFile = useCallback(
    async (chosen: File) => {
      if (busyRef.current) {
        return;
      }
      busyRef.current = true;
      setActionError(null);
      setValidation(null);
      setDetection(null);
      setPhase("working");
      try {
        const buffer = await chosen.arrayBuffer();
        const { parseSpreadsheet } = await import("@/lib/import/parse");
        const rows = parseSpreadsheet(buffer);
        await processRows(rows);
      } catch (reason) {
        const code = (reason as { code?: string }).code;
        if (code === "empty") {
          pushToast("error", t("import.fileEmpty"));
        } else if (code === "corrupted") {
          pushToast("error", t("import.fileCorrupted"));
        } else {
          pushToast("error", errorMessage(reason, t("errors.generic")));
        }
        setPhase("idle");
      } finally {
        busyRef.current = false;
      }
    },
    [processRows, t],
  );

  const handleFileChosen = useCallback(
    (chosen: File | null | undefined) => {
      if (!chosen) {
        return;
      }
      if (!/\.(xlsx|xls)$/i.test(chosen.name)) {
        pushToast("error", t("import.invalidFile"));
        return;
      }
      setFile(chosen);
      void parseFile(chosen);
    },
    [parseFile, t],
  );

  const loadSheet = useCallback(async () => {
    if (busyRef.current) {
      return;
    }
    const target = parseGoogleSheetUrl(sheetUrl);
    if (!target) {
      setActionError(t("import.invalidUrl"));
      pushToast("error", t("import.invalidUrl"));
      return;
    }
    busyRef.current = true;
    setActionError(null);
    setValidation(null);
    setDetection(null);
    setPhase("working");
    try {
      const payload = await apiSend<{ csv: string }>("/api/import/sheet", "POST", {
        url: sheetUrl.trim(),
      });
      const { parseSpreadsheet } = await import("@/lib/import/parse");
      const rows = parseSpreadsheet(payload.csv);
      await processRows(rows);
    } catch (reason) {
      const message = errorMessage(reason, t("import.sheetUnreachable"));
      setActionError(message);
      pushToast("error", t("import.sheetUnreachable"), message);
      setPhase("idle");
    } finally {
      busyRef.current = false;
    }
  }, [processRows, sheetUrl, t]);

  const confirmImport = useCallback(async () => {
    if (busyRef.current || !validation) {
      return;
    }
    const items = validation.rows
      .filter((row) => rowOutcome(row) === "import" && row.record)
      .map((row) => ({
        tag: row.record!.tag,
        name: row.record!.name,
        category: row.record!.category,
        status: row.record!.status,
        location: row.record!.location,
      }));
    if (items.length === 0) {
      return;
    }
    busyRef.current = true;
    setActionError(null);
    setPhase("working");
    try {
      const result = await apiSend<ImportCommitResult>("/api/assets/import", "POST", {
        items,
      });
      notifyDataChanged("import");
      setCommitResult(result);
      setPhase("done");
      pushToast(
        "success",
        t("import.resultTitle"),
        `${t("import.resultImported", { count: result.imported })} · ${t("import.resultSkipped", { count: result.skipped })} · ${t("import.resultRejected", { count: result.rejected })}`,
      );
    } catch (reason) {
      setActionError(errorMessage(reason, t("import.importFailed")));
      pushToast("error", t("import.importFailed"));
      setPhase("preview");
    } finally {
      busyRef.current = false;
    }
  }, [t, validation]);

  const previewRows = useMemo(
    () => (validation ? validation.rows.slice(0, PREVIEW_LIMIT) : []),
    [validation],
  );

  const importableCount = validation?.importable.length ?? 0;

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
        tabIndex={-1}
        className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-line/50 bg-panel text-ink shadow-2xl focus:outline-none sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line/40 bg-header px-5 py-4">
          <div className="min-w-0">
            <p className="eyebrow">{t("import.title")}</p>
            <h2 id="import-dialog-title" className="text-sm font-semibold text-ink">
              {t("import.subtitle")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t("common.close")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line/50 text-muted transition-colors hover:text-ink disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {phase !== "done" && (
            <>
              <div
                role="tablist"
                aria-label={t("import.title")}
                className="mb-5 flex gap-2 rounded-2xl border border-line/40 bg-inset p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "file"}
                  disabled={busy}
                  onClick={() => setMode("file")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    mode === "file"
                      ? "bg-panel text-accent shadow-sm"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  {t("import.tabFile")}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "sheet"}
                  disabled={busy}
                  onClick={() => setMode("sheet")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    mode === "sheet"
                      ? "bg-panel text-accent shadow-sm"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                  {t("import.tabSheet")}
                </button>
              </div>

              {mode === "file" && (
                <div className="flex flex-col gap-3">
                  <div
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (!busy) setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragActive(false);
                      if (!busy) {
                        handleFileChosen(event.dataTransfer.files?.[0]);
                      }
                    }}
                    className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                      dragActive
                        ? "border-accent bg-accent-soft"
                        : "border-line/60 bg-inset"
                    }`}
                  >
                    <FileSpreadsheet className="h-8 w-8 text-accent" aria-hidden="true" />
                    <p className="text-sm text-muted">
                      {t("import.dropzone")}{" "}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => fileInputRef.current?.click()}
                        className="font-semibold text-accent underline-offset-2 hover:underline"
                      >
                        {t("import.browse")}
                      </button>
                    </p>
                    <p className="font-mono text-[11px] tracking-wide text-faint">
                      {t("import.dropHint")}
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className="sr-only"
                      aria-label={t("import.tabFile")}
                      onChange={(event) => {
                        handleFileChosen(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </div>

                  {file && (
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line/50 bg-inset px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <FileSpreadsheet
                          className="h-4 w-4 shrink-0 text-accent"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">
                            {file.name}
                          </p>
                          <p className="eyebrow">{t("import.selectedFile")}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setFile(null);
                          setValidation(null);
                          setDetection(null);
                          setPhase("idle");
                        }}
                        className="btn-ghost"
                      >
                        {t("import.removeFile")}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {mode === "sheet" && (
                <div className="flex flex-col gap-3">
                  <div className="rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3">
                    <p className="text-xs font-semibold text-warning">
                      {t("import.sheetNoticeTitle")}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      {t("import.sheetNotice")}
                    </p>
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <span className="eyebrow">{t("import.sheetLabel")}</span>
                    <input
                      type="url"
                      value={sheetUrl}
                      onChange={(event) => setSheetUrl(event.target.value)}
                      placeholder={t("import.sheetPlaceholder")}
                      disabled={busy}
                      className="field"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void loadSheet()}
                    disabled={busy || !sheetUrl.trim()}
                    className="btn-primary self-start"
                  >
                    {busy && mode === "sheet"
                      ? t("import.parsing")
                      : t("import.loadSheet")}
                  </button>
                </div>
              )}

              {phase === "working" && mode === "file" && (
                <p className="mt-4 text-sm text-muted" role="status">
                  {t("import.parsing")}
                </p>
              )}

              {actionError && (
                <p role="alert" className="mt-4 text-sm text-danger">
                  {actionError}
                </p>
              )}
            </>
          )}

          {phase === "preview" && validation && detection && (
            <section className="flex flex-col gap-4">
              <div>
                <p className="eyebrow">{t("import.previewTitle")}</p>
                <p className="mt-1 text-sm text-muted">{t("import.previewHint")}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="badge bg-header text-muted">
                  {t("import.summaryRows", { count: validation.rows.length })}
                </span>
                <span className="badge bg-success/10 text-success">
                  {t("import.summaryReady", { count: importableCount })}
                </span>
                {validation.errorCount > 0 && (
                  <span className="badge bg-danger/10 text-danger">
                    {t("import.summaryErrors", { count: validation.errorCount })}
                  </span>
                )}
                {validation.warningCount > 0 && (
                  <span className="badge bg-warning/10 text-warning">
                    {t("import.summarySkipped", { count: validation.warningCount })}
                  </span>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-line/40">
                <div className="max-h-72 overflow-auto">
                  <table className="w-full min-w-[640px] border-collapse text-left">
                    <thead className="sticky top-0 z-10 bg-header">
                      <tr>
                        <th scope="col" className="eyebrow px-3 py-2">
                          {t("import.columnRow")}
                        </th>
                        <th scope="col" className="eyebrow px-3 py-2">
                          {t("import.columnTag")}
                        </th>
                        <th scope="col" className="eyebrow px-3 py-2">
                          {t("import.columnName")}
                        </th>
                        <th scope="col" className="eyebrow px-3 py-2">
                          {t("import.columnCategory")}
                        </th>
                        <th scope="col" className="eyebrow px-3 py-2">
                          {t("import.columnStatus")}
                        </th>
                        <th scope="col" className="eyebrow px-3 py-2">
                          {t("import.columnIssues")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => {
                        const outcome = rowOutcome(row);
                        return (
                          <tr
                            key={row.rowNumber}
                            className={`border-t border-line/30 ${
                              outcome === "reject"
                                ? "bg-danger/5"
                                : outcome === "skip"
                                  ? "bg-warning/5"
                                  : ""
                            }`}
                          >
                            <td className="px-3 py-2 font-mono text-[12px] text-muted">
                              {row.rowNumber}
                            </td>
                            <td className="px-3 py-2 font-mono text-[12px] text-accent">
                              {row.record?.tag ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-[13px] text-ink">
                              {row.record?.name ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-[13px] text-muted">
                              {row.record ? tCategory(row.record.category) : "—"}
                            </td>
                            <td className="px-3 py-2 text-[13px] text-muted">
                              {row.record ? tStatus(row.record.status) : "—"}
                            </td>
                            <td className="px-3 py-2">
                              {row.issues.length === 0 ? (
                                <span className="font-mono text-[11px] text-faint">—</span>
                              ) : (
                                <span className="flex flex-wrap gap-1">
                                  {row.issues.map((issue, index) => (
                                    <span
                                      key={`${issue.code}-${index}`}
                                      className={`badge ${
                                        issue.severity === "error"
                                          ? "bg-danger/10 text-danger"
                                          : "bg-warning/10 text-warning"
                                      }`}
                                    >
                                      {issueLabel(t, issue)}
                                    </span>
                                  ))}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {validation.rows.length > PREVIEW_LIMIT && (
                  <p className="border-t border-line/40 bg-header px-3 py-2 font-mono text-[11px] text-faint">
                    {t("import.previewMore", { count: PREVIEW_LIMIT })}
                  </p>
                )}
              </div>

              {importableCount === 0 && (
                <p className="text-sm text-danger">{t("import.noImportable")}</p>
              )}
            </section>
          )}

          {phase === "done" && commitResult && (
            <section className="flex flex-col items-center gap-4 py-6 text-center">
              <p className="eyebrow">{t("import.resultTitle")}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="badge bg-success/10 text-success">
                  {t("import.resultImported", { count: commitResult.imported })}
                </span>
                <span className="badge bg-warning/10 text-warning">
                  {t("import.resultSkipped", { count: commitResult.skipped })}
                </span>
                <span className="badge bg-danger/10 text-danger">
                  {t("import.resultRejected", { count: commitResult.rejected })}
                </span>
              </div>
              {commitResult.failures.length > 0 && (
                <ul className="max-w-md text-left text-xs text-muted">
                  {commitResult.failures.slice(0, 10).map((failure, index) => (
                    <li key={`${failure.rowNumber}-${index}`} className="font-mono">
                      {t("import.columnRow")} {failure.rowNumber}: {failure.tag ?? "—"} —{" "}
                      {failure.code}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line/40 bg-header px-5 py-4">
          {phase === "preview" && (
            <>
              <button type="button" className="btn-ghost" onClick={onClose}>
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={busy || importableCount === 0}
                onClick={() => void confirmImport()}
              >
                {busy
                  ? t("import.importing")
                  : t("import.confirm", { count: importableCount })}
              </button>
            </>
          )}
          {phase === "done" && (
            <button type="button" className="btn-primary" onClick={onClose}>
              {t("import.done")}
            </button>
          )}
          {(phase === "idle" || phase === "working") && (
            <button
              type="button"
              className="btn-ghost"
              onClick={onClose}
              disabled={busy}
            >
              {t("common.cancel")}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
