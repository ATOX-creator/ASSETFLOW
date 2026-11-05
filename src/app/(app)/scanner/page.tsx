"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  CircleCheck,
  CircleX,
  Hash,
  LoaderCircle,
  ScanLine,
  Search,
  UserRound,
} from "lucide-react";
import OpticalScanner, { type ScanResult } from "@/components/OpticalScanner";
import { useApp } from "@/lib/i18n";
import { apiGet, apiSend, errorMessage } from "@/lib/api/client";
import { notifyDataChanged } from "@/lib/dataRefresh";
import type { AssetsResponse, ScanResponse } from "@/lib/api/types";
import type { AssetLogRecord, AssetRecord } from "@/lib/data";
import { ASSET_STATUSES, isAssetStatus, type AssetStatus } from "@/lib/constants";
import {
  extractIdentifiers,
  validateIdentifier,
  type ExtractedIdentifier,
} from "@/lib/scan/identifiers";
import { TONE_BADGE, toneOf } from "@/lib/visuals";
import { EmptyBlock } from "@/components/StateBlocks";

type Stage =
  | "idle"
  | "capture_review"
  | "looking"
  | "found"
  | "unknown"
  | "serial"
  | "saving"
  | "saved"
  | "error";

type SerialStage = "ready" | "logging" | "logged";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="eyebrow">{label}</p>
      <p className="text-sm text-ink">{value}</p>
    </div>
  );
}

export default function ScannerPage() {
  const { t, tStatus, tCategory, user, formatDate } = useApp();

  const [stage, setStage] = useState<Stage>("idle");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [asset, setAsset] = useState<AssetRecord | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<AssetStatus>("available");
  const [message, setMessage] = useState<string | null>(null);
  const [savedAsset, setSavedAsset] = useState<AssetRecord | null>(null);
  const [savedLog, setSavedLog] = useState<AssetLogRecord | null>(null);
  const [candidates, setCandidates] = useState<ExtractedIdentifier[]>([]);
  const [activeIdentifier, setActiveIdentifier] = useState<ExtractedIdentifier | null>(null);
  const [serialStage, setSerialStage] = useState<SerialStage>("ready");
  const [serialLogged, setSerialLogged] = useState<ExtractedIdentifier | null>(null);
  const [reviewValue, setReviewValue] = useState("");
  const [rescanSignal, setRescanSignal] = useState(0);
  const submittingRef = useRef(false);
  const submissionIdRef = useRef("");

  const logScanEvent = useCallback(
    async (identifier: ExtractedIdentifier, method: ScanResult["method"]) => {
      try {
        await apiSend("/api/scan/events", "POST", {
          identifier: identifier.value,
          captureMethod: method,
        });
      } catch {
        // event logging is best-effort; the scan workflow continues
      }
    },
    [],
  );

  const processIdentifier = useCallback(
    async (identifier: ExtractedIdentifier, result: ScanResult) => {
      setScan(result);
      setMessage(null);
      setSavedAsset(null);
      setSavedLog(null);
      setSerialLogged(null);
      setActiveIdentifier(identifier);

      if (identifier.type === "serial_number") {
        setAsset(null);
        setSerialStage("ready");
        setStage("serial");
        return;
      }

      const tag = identifier.value;
      setStage("looking");
      try {
        const payload = await apiGet<AssetsResponse>(
          `/api/assets?search=${encodeURIComponent(tag)}`,
        );
        const match =
          payload.items.find((entry) => entry.tag.toLowerCase() === tag.toLowerCase()) ?? null;

        if (match) {
          setAsset(match);
          setSelectedStatus(match.status);
          setStage("found");
          return;
        }

        setAsset(null);
        setSelectedStatus("available");
        setStage("unknown");
      } catch (reason) {
        setStage("error");
        setMessage(errorMessage(reason, t("errors.loadFailed")));
      }
    },
    [t],
  );

  const handleScanComplete = useCallback(
    (result: ScanResult) => {
      setScan(result);
      setMessage(null);
      setSavedAsset(null);
      setSavedLog(null);
      setSerialLogged(null);

      const identifiers = extractIdentifiers(result.payload);
      setCandidates(identifiers);
      if (identifiers.length === 0) {
        setReviewValue(result.payload);
      } else {
        setReviewValue(identifiers[0]?.value ?? "");
      }
      setStage("capture_review");
    },
    [],
  );

  const confirmCapturedValue = useCallback(() => {
    if (!scan || submittingRef.current) {
      return;
    }
    const validated = validateIdentifier(reviewValue);
    if (!validated.ok) {
      setMessage(t("scanner.noValidIdentifier"));
      return;
    }
    setMessage(null);
    void processIdentifier(validated.identifier, scan);
  }, [processIdentifier, reviewValue, scan, t]);

  const rejectCapturedValue = useCallback(() => {
    setStage("idle");
    setScan(null);
    setAsset(null);
    setMessage(null);
    setCandidates([]);
    setActiveIdentifier(null);
    setReviewValue("");
    submittingRef.current = false;
    submissionIdRef.current = "";
    setRescanSignal((value) => value + 1);
  }, []);

  const saveScan = useCallback(async () => {
    if (!scan || !asset || stage === "saving" || submittingRef.current) {
      return;
    }
    const tag = activeIdentifier?.value ?? scan.payload.trim();
    if (!isAssetStatus(selectedStatus)) {
      setMessage(t("scanner.invalidStatus"));
      return;
    }

    submittingRef.current = true;
    if (!submissionIdRef.current) {
      submissionIdRef.current = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    }
    setStage("saving");
    setMessage(null);

    try {
      const result = await apiSend<ScanResponse>("/api/scan", "POST", {
        tag,
        status: selectedStatus,
        format: scan.format,
        submissionId: submissionIdRef.current,
      });
      if (activeIdentifier) {
        void logScanEvent(activeIdentifier, scan.method);
      }
      notifyDataChanged("scan");
      setSavedAsset(result.asset);
      setSavedLog(result.log);
      setAsset(result.asset);
      setStage("saved");
    } catch (reason) {
      setMessage(errorMessage(reason, t("scanner.saveError")));
      setStage("found");
    } finally {
      submittingRef.current = false;
    }
  }, [activeIdentifier, asset, logScanEvent, scan, selectedStatus, stage, t]);

  const logSerial = useCallback(async () => {
    if (!activeIdentifier || serialStage === "logging" || submittingRef.current) {
      return;
    }
    submittingRef.current = true;
    setSerialStage("logging");
    setMessage(null);
    try {
      const response = await apiSend<{ event: unknown }>(
        "/api/scan/events",
        "POST",
        {
          identifier: activeIdentifier.value,
          captureMethod: scan?.method ?? "manual",
        },
      );
      if (response.event) {
        notifyDataChanged("scan");
        setSerialLogged(activeIdentifier);
        setSerialStage("logged");
      }
    } catch (reason) {
      setMessage(errorMessage(reason, t("scanner.saveError")));
      setSerialStage("ready");
    } finally {
      submittingRef.current = false;
    }
  }, [activeIdentifier, scan, serialStage, t]);

  const reset = useCallback(() => {
    setStage("idle");
    setScan(null);
    setAsset(null);
    setMessage(null);
    setSavedAsset(null);
    setSavedLog(null);
    setCandidates([]);
    setActiveIdentifier(null);
    setSerialStage("ready");
    setSerialLogged(null);
    setReviewValue("");
    submittingRef.current = false;
    submissionIdRef.current = "";
    setSelectedStatus("available");
    setRescanSignal((value) => value + 1);
  }, []);

  const busy = stage === "saving" || stage === "looking";

  return (
    <div className="mx-auto grid max-w-[1600px] items-start gap-6 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <OpticalScanner
        onScanComplete={handleScanComplete}
        rescanSignal={rescanSignal}
      />

      <section className="panel overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line/40 bg-header px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-accent/40 bg-inset text-accent">
              <Search className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="eyebrow">{t("scanner.stepReview")}</p>
              <h2 className="text-sm font-semibold text-ink">{t("scanner.title")}</h2>
            </div>
          </div>
          <span className="badge tone-blue">{t("scanner.stepSave")}</span>
        </header>

        <div className="flex flex-col gap-4 p-5">
          <ol className="flex flex-wrap gap-2">
            {[t("scanner.stepIdentify"), t("scanner.stepStatus"), t("scanner.stepSave")].map(
              (label, index) => (
                <li
                  key={label}
                  className="flex items-center gap-2 rounded-xl border border-line/40 bg-inset px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted"
                >
                  <span className="text-accent">{index + 1}</span>
                  {label}
                </li>
              ),
            )}
          </ol>

          {stage === "idle" && (
            <EmptyBlock title={t("scanner.awaiting")} hint={t("scanner.awaitingHint")} />
          )}

          {stage === "capture_review" && scan && (
            <div className="flex flex-col gap-4" role="group" aria-label="Review captured value">
              <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
                <p className="text-sm font-semibold text-ink">Review captured value</p>
                <p className="mt-1 text-xs text-muted">
                  Capture method: {scan.method === "qr_code" ? "QR code" : scan.method === "barcode" ? "Barcode" : scan.method === "camera_ocr" ? "OCR text" : "Text"}
                </p>
              </div>
              <label htmlFor="captured-value" className="eyebrow">Captured value</label>
              <input
                id="captured-value"
                type="text"
                value={reviewValue}
                onChange={(event) => setReviewValue(event.target.value)}
                className="field font-mono text-accent"
                autoComplete="off"
              />
              {candidates.length > 1 && (
                <div className="flex flex-wrap gap-2" aria-label="Detected identifiers">
                  {candidates.map((candidate) => (
                    <button
                      key={`${candidate.type}-${candidate.value}`}
                      type="button"
                      onClick={() => setReviewValue(candidate.value)}
                      className="btn-ghost font-mono text-xs"
                    >
                      {candidate.value}
                    </button>
                  ))}
                </div>
              )}
              {message && <p role="alert" className="text-xs text-danger">{message}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={confirmCapturedValue} className="btn-primary">
                  <CircleCheck className="h-4 w-4" aria-hidden="true" />
                  Confirm and continue
                </button>
                <button type="button" onClick={rejectCapturedValue} className="btn-ghost">
                  <CircleX className="h-4 w-4" aria-hidden="true" />
                  Reject and scan again
                </button>
              </div>
            </div>
          )}

          {stage === "looking" && (
            <div className="flex items-center gap-3 px-2 py-10 text-muted">
              <LoaderCircle className="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
              <span className="text-sm">{t("scanner.lookingUp")}</span>
            </div>
          )}

          {stage === "serial" && (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-accent/40 bg-inset px-4 py-3">
                <div className="flex items-start gap-2">
                  <Hash className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {t("scanner.serialTitle")}
                    </p>
                    <p className="mt-1 font-mono text-xs text-accent">
                      {activeIdentifier?.value ?? scan?.payload}
                    </p>
                  </div>
                </div>
              </div>

              {serialStage === "logged" && serialLogged ? (
                <>
                  <div className="flex items-start gap-3 rounded-xl border border-success/40 bg-success/10 px-4 py-4">
                    <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        {t("scanner.serialLogged")}
                      </p>
                      <p className="text-xs text-muted">{t("scanner.serialLoggedHint")}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={reset} className="btn-primary">
                      <ScanLine className="h-4 w-4" aria-hidden="true" />
                      {t("scanner.scanAnother")}
                    </button>
                    <Link href="/log" className="btn-ghost">
                      {t("common.viewAll")}
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
                    <p className="text-sm font-semibold text-ink">
                      {t("scanner.serialUnmatched")}
                    </p>
                    <p className="mt-1 text-xs text-muted">{t("scanner.serialHint")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void logSerial()}
                      disabled={serialStage === "logging"}
                      className="btn-primary"
                    >
                      {serialStage === "logging" ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <CircleCheck className="h-4 w-4" aria-hidden="true" />
                      )}
                      {t("scanner.logSerial")}
                    </button>
                    <button type="button" onClick={reset} className="btn-ghost">
                      {t("common.cancel")}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {(stage === "found" || stage === "saving") && asset && (
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3 rounded-xl border border-success/40 bg-success/10 px-4 py-3">
                <div className="flex items-start gap-2">
                  <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-ink">{t("scanner.found")}</p>
                    <p className="text-xs text-muted">{asset.tag}</p>
                  </div>
                </div>
                <span className={`badge ${TONE_BADGE[toneOf(asset.status)]}`}>
                  {tStatus(asset.status)}
                </span>
              </div>

              <div className="rounded-xl border border-line/50 bg-inset p-4">
                <p className="text-base font-semibold text-ink">{asset.name}</p>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Row label={t("common.assetTag")} value={<span className="font-mono text-accent">{asset.tag}</span>} />
                  <Row label={t("common.categoryName")} value={tCategory(asset.category)} />
                  <Row
                    label={t("scanner.currentStatus")}
                    value={<span className={`badge ${TONE_BADGE[toneOf(asset.status)]}`}>{tStatus(asset.status)}</span>}
                  />
                  <Row
                    label={t("assets.lastScan")}
                    value={
                      asset.lastScannedAt ? (
                        <span className="font-mono text-xs text-muted">
                          {formatDate(asset.lastScannedAt)}
                        </span>
                      ) : (
                        <span className="text-muted">{t("common.none")}</span>
                      )
                    }
                  />
                  <Row label={t("common.date")} value={<span className="font-mono text-xs text-muted">{formatDate(scan?.timestamp ?? Date.now())}</span>} />
                  <Row
                    label={t("common.scannedBy")}
                    value={
                      <span className="flex items-center gap-2 text-xs text-muted">
                        <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                        {user?.name ?? t("errors.missingUser")}
                      </span>
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="scan-status" className="eyebrow">
                  {t("scanner.selectStatus")}
                </label>
                <select
                  id="scan-status"
                  value={selectedStatus}
                  onChange={(event) => setSelectedStatus(event.target.value as AssetStatus)}
                  className="field cursor-pointer"
                >
                  {ASSET_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {tStatus(status)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted">
                  {selectedStatus === asset.status
                    ? t("scanner.unchanged")
                    : t("scanner.selectStatusHint")}
                </p>
              </div>
            </div>
          )}

          {(stage === "unknown") && scan && (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
                <p className="text-sm font-semibold text-ink">{t("scanner.notFound")}</p>
                <p className="text-xs text-muted">{t("scanner.notFoundHint", { tag: activeIdentifier?.value ?? scan.payload.trim() })}</p>
              </div>
              <button type="button" onClick={rejectCapturedValue} className="btn-ghost self-start">Retry scanning</button>
            </div>
          )}

          {stage === "saved" && savedAsset && (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 rounded-xl border border-success/40 bg-success/10 px-4 py-4">
                <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{t("scanner.scanSaved")}</p>
                  <p className="text-xs text-muted">{t("scanner.scanSavedHint")}</p>
                </div>
              </div>

              <div className="rounded-xl border border-line/50 bg-inset p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-ink">{savedAsset.name}</p>
                    <p className="font-mono text-xs text-accent">{savedAsset.tag}</p>
                  </div>
                  <span className={`badge ${TONE_BADGE[toneOf(savedAsset.status)]}`}>
                    {tStatus(savedAsset.status)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <Row label={t("common.categoryName")} value={tCategory(savedAsset.category)} />
                  <Row
                    label={t("scanner.previousStatus")}
                    value={
                      savedLog?.previousStatus ? (
                        <span className={`badge ${TONE_BADGE[toneOf(savedLog.previousStatus)]}`}>
                          {tStatus(savedLog.previousStatus)}
                        </span>
                      ) : (
                        <span className="text-muted">{t("common.none")}</span>
                      )
                    }
                  />
                  <Row
                    label={t("common.date")}
                    value={
                      <span className="font-mono text-xs text-muted">
                        {savedLog ? formatDate(savedLog.scannedAt, "date") : "—"}
                      </span>
                    }
                  />
                  <Row
                    label={t("common.time")}
                    value={
                      <span className="font-mono text-xs text-muted">
                        {savedLog ? formatDate(savedLog.scannedAt, "time") : "—"}
                      </span>
                    }
                  />
                  <Row
                    label={t("common.scannedBy")}
                    value={
                      <span className="text-xs text-muted">
                        {savedLog?.scannedByName ?? user?.name ?? t("common.unknown")}
                      </span>
                    }
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={reset} className="btn-primary">
                  <ScanLine className="h-4 w-4" aria-hidden="true" />
                  {t("scanner.scanAnother")}
                </button>
                <Link href="/log" className="btn-ghost">
                  {t("common.viewAll")}
                </Link>
                <Link
                  href={`/assets?search=${encodeURIComponent(savedAsset.tag)}`}
                  className="btn-ghost"
                >
                  {t("common.details")}
                </Link>
              </div>
            </div>
          )}

          {stage === "error" && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3">
              <p className="text-sm font-semibold text-danger">{t("common.errorTitle")}</p>
              <p className="mt-1 text-xs text-muted">{message ?? t("errors.generic")}</p>
            </div>
          )}

          {message && stage !== "error" && stage !== "saving" && (
            <p role="alert" className="text-xs text-danger">
              {message}
            </p>
          )}

          {(stage === "found" || stage === "saving") && (
            <div className="flex flex-wrap gap-2 border-t border-line/40 pt-4">
              <button
                type="button"
                onClick={() => void saveScan()}
                disabled={busy}
                className="btn-primary"
              >
                {stage === "saving" ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CircleCheck className="h-4 w-4" aria-hidden="true" />
                )}
                {stage === "saving" ? t("scanner.saving") : t("scanner.saveScan")}
              </button>
              <button type="button" onClick={reset} className="btn-ghost" disabled={busy}>
                {t("common.cancel")}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
