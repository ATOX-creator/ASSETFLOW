"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  CircleCheck,
  Flashlight,
  FlashlightOff,
  Keyboard,
  LoaderCircle,
  Play,
  RotateCw,
  ScanBarcode,
  ScanLine,
  Square,
  SwitchCamera,
  TriangleAlert,
} from "lucide-react";
import type {
  Html5Qrcode,
  Html5QrcodeCameraScanConfig,
  Html5QrcodeResult,
} from "html5-qrcode";
import { useApp } from "@/lib/i18n";
import {
  captureMethodFromFormat,
  extractIdentifiers,
  type CaptureMethod,
} from "@/lib/scan/identifiers";

export interface ScanResult {
  payload: string;
  format: string;
  timestamp: number;
  method: CaptureMethod;
}

export function formatTimestamp(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${day} ${clock}`;
}

type ScanPhase =
  | "idle"
  | "requesting_permission"
  | "scanning"
  | "scanned"
  | "error";

interface CameraOption {
  id: string;
  label: string;
}

type FaultCode =
  | "permission"
  | "noDevice"
  | "busy"
  | "secure"
  | "unsupported"
  | "generic";

interface CameraFault {
  code: FaultCode;
  detail: string;
}

interface OpticalScannerProps {
  onScanComplete: (scan: ScanResult) => void;
}

const READER_ELEMENT_ID = "reader";
const SCAN_CONFIG: Html5QrcodeCameraScanConfig = { fps: 10, disableFlip: false };
const DEFAULT_CAMERA: MediaTrackConstraints = { facingMode: "environment" };
const DUPLICATE_COOLDOWN_MS = 2000;
const MANUAL_FORMAT = "MANUAL_INPUT";
const OCR_FORMAT = "OCR_TEXT";
const OCR_TIMEOUT_MS = 25_000;
const OCR_MAX_WIDTH = 1600;

function captureVideoFrame(): string | null {
  const container = document.getElementById(READER_ELEMENT_ID);
  const video = container?.querySelector("video");
  if (!(video instanceof HTMLVideoElement) || video.videoWidth === 0) {
    return null;
  }
  const scale = Math.min(1, OCR_MAX_WIDTH / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

function classifyCameraFault(raw: unknown): CameraFault {
  const source =
    raw instanceof Error
      ? `${raw.name}: ${raw.message}`
      : typeof raw === "string"
        ? raw
        : "Unknown camera error";
  const text = source.toLowerCase();

  if (
    text.includes("notallowederror") ||
    text.includes("permission denied") ||
    text.includes("permissiondismissed") ||
    text.includes("not allowed") ||
    text.includes("denied")
  ) {
    return { code: "permission", detail: source };
  }
  if (
    text.includes("notfounderror") ||
    text.includes("requested device not found") ||
    text.includes("no video capture devices") ||
    text.includes("no camera")
  ) {
    return { code: "noDevice", detail: source };
  }
  if (
    text.includes("notreadableerror") ||
    text.includes("could not start video source") ||
    text.includes("in use") ||
    text.includes("aborterror")
  ) {
    return { code: "busy", detail: source };
  }
  if (text.includes("insecure") || text.includes("secure context")) {
    return { code: "secure", detail: source };
  }
  if (text.includes("notsupported") || text.includes("navigator.mediadevices")) {
    return { code: "unsupported", detail: source };
  }
  return { code: "generic", detail: source };
}

function ReadoutCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        {label}
      </p>
      <p className="font-mono text-[12px] leading-snug tracking-[0.04em] break-all text-ink">
        {value}
      </p>
    </div>
  );
}

export default function OpticalScanner({ onScanComplete }: OpticalScannerProps) {
  const { t } = useApp();
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [fault, setFault] = useState<CameraFault | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [cameraLive, setCameraLive] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [hardware, setHardware] = useState("STANDBY");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);
  const manualInputRef = useRef<HTMLInputElement | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const lockRef = useRef(false);
  const seenRef = useRef<{ payload: string; at: number } | null>(null);
  const activeCameraRef = useRef<string>("");
  const audioRef = useRef<AudioContext | null>(null);
  const completionRef = useRef(onScanComplete);
  const mountedRef = useRef(true);

  useEffect(() => {
    completionRef.current = onScanComplete;
  }, [onScanComplete]);

  const signalHit = useCallback((): void => {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch {
        // vibration feedback is advisory, some browsers reject it
      }
    }

    try {
      const BrowserAudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!BrowserAudioContext) {
        return;
      }
      const context = audioRef.current ?? new BrowserAudioContext();
      audioRef.current = context;
      if (context.state === "suspended") {
        void context.resume().catch(() => undefined);
      }
      const startedAt = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(880, startedAt);
      oscillator.frequency.setValueAtTime(1320, startedAt + 0.06);
      gain.gain.setValueAtTime(0.0001, startedAt);
      gain.gain.exponentialRampToValueAtTime(0.12, startedAt + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.18);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startedAt);
      oscillator.stop(startedAt + 0.2);
    } catch {
      audioRef.current = null;
    }
  }, []);

  const applyVideoLayout = useCallback((): void => {
    const container = document.getElementById(READER_ELEMENT_ID);
    const video = container?.querySelector("video");
    if (!(video instanceof HTMLVideoElement)) {
      return;
    }
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.objectFit = "cover";
    video.muted = true;
    video.playsInline = true;
    const playback = video.play();
    if (playback) {
      void playback.catch(() => undefined);
    }
  }, []);

  const sweepOrphanedMedia = useCallback((): void => {
    const container = document.getElementById(READER_ELEMENT_ID);
    if (!container) {
      return;
    }
    const video = container.querySelector("video");
    if (video instanceof HTMLVideoElement) {
      const stream = video.srcObject;
      if (stream instanceof MediaStream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      video.srcObject = null;
    }
    container.innerHTML = "";
  }, []);

  const releaseCamera = useCallback(async (): Promise<void> => {
    const scanner = scannerRef.current;
    try {
      if (scanner) {
        let isRunning = false;
        try {
          const { Html5QrcodeScannerState } = await import("html5-qrcode");
          isRunning = scanner.getState() !== Html5QrcodeScannerState.NOT_STARTED;
        } catch {
          isRunning = false;
        }

        if (isRunning) {
          try {
            await scanner.stop();
          } catch {
            sweepOrphanedMedia();
          }
        } else {
          sweepOrphanedMedia();
        }

        try {
          scanner.clear();
        } catch {
          // container was already emptied
        }
      } else {
        sweepOrphanedMedia();
      }
    } catch {
      sweepOrphanedMedia();
    }

    if (mountedRef.current) {
      setCameraLive(false);
      setTorchOn(false);
      setTorchSupported(false);
    }
  }, [sweepOrphanedMedia]);

  const handleDecodeSuccess = useCallback(
    (decodedText: string, decoded: Html5QrcodeResult): void => {
      if (lockRef.current) {
        return;
      }
      const payload = decodedText.trim();
      if (!payload) {
        return;
      }
      const at = Date.now();
      const seen = seenRef.current;
      if (seen && seen.payload === payload && at - seen.at < DUPLICATE_COOLDOWN_MS) {
        return;
      }

      lockRef.current = true;
      seenRef.current = { payload, at };

      const format = decoded.result.format?.formatName ?? "UNKNOWN";
      const scan: ScanResult = {
        payload,
        format,
        timestamp: at,
        method: captureMethodFromFormat(format),
      };

      setResult(scan);
      signalHit();

      const scanner = scannerRef.current;
      if (scanner) {
        try {
          scanner.pause(true);
        } catch {
          setPhase("scanned");
        }
      }
      if (mountedRef.current) {
        setPhase("scanned");
      }
      completionRef.current(scan);
    },
    [signalHit],
  );

  const refreshHardware = useCallback(async (scanner: Html5Qrcode): Promise<void> => {
    let options: CameraOption[] = [];
    let activeId = "";

    try {
      activeId = scanner.getRunningTrackSettings().deviceId ?? "";
    } catch {
      activeId = "";
    }
    activeCameraRef.current = activeId;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      options = devices
        .filter((device) => device.kind === "videoinput")
        .map((device, index) => ({
          id: device.deviceId,
          label: device.label || t("terminal.cameraInput", { n: index + 1 }),
        }));
    } catch {
      options = [];
    }

    try {
      const torch = scanner.getRunningTrackCameraCapabilities().torchFeature();
      if (mountedRef.current) {
        setTorchSupported(torch.isSupported());
      }
    } catch {
      if (mountedRef.current) {
        setTorchSupported(false);
      }
    }

    if (!mountedRef.current) {
      return;
    }
    if (options.length > 0) {
      setCameras(options);
    }
    const active = options.find((option) => option.id === activeId);
    setHardware(active ? active.label : activeId || "UNKNOWN");
  }, [t]);

  const startScanner = useCallback(
    async (target?: string | MediaTrackConstraints): Promise<void> => {
      if (busyRef.current) {
        return;
      }
      busyRef.current = true;
      lockRef.current = false;

      if (mountedRef.current) {
        setPhase("requesting_permission");
        setFault(null);
        setResult(null);
        setCameraLive(false);
        setTorchOn(false);
      }

      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mountedRef.current) {
          return;
        }

        let scanner = scannerRef.current;
        if (!scanner) {
          scanner = new Html5Qrcode(READER_ELEMENT_ID, {
            verbose: false,
            useBarCodeDetectorIfSupported: true,
          });
          scannerRef.current = scanner;
        }

        await scanner.start(
          target ?? DEFAULT_CAMERA,
          SCAN_CONFIG,
          handleDecodeSuccess,
          undefined,
        );

        if (!mountedRef.current) {
          await releaseCamera();
          return;
        }

        applyVideoLayout();
        setCameraLive(true);
        setPhase("scanning");
        void refreshHardware(scanner);
      } catch (raw) {
        if (!mountedRef.current) {
          return;
        }
        await releaseCamera();
        setCameraLive(false);
        setFault(classifyCameraFault(raw));
        setPhase("error");
      } finally {
        busyRef.current = false;
      }
    },
    [applyVideoLayout, handleDecodeSuccess, refreshHardware, releaseCamera],
  );

  const stopScanner = useCallback(async (): Promise<void> => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    try {
      await releaseCamera();
      lockRef.current = false;
      seenRef.current = null;
      if (mountedRef.current) {
        setPhase("idle");
        setFault(null);
        setResult(null);
      }
    } finally {
      busyRef.current = false;
    }
  }, [releaseCamera]);

  const resumeScanner = useCallback((): void => {
    const scanner = scannerRef.current;
    if (!scanner) {
      void startScanner();
      return;
    }
    try {
      scanner.resume();
      lockRef.current = false;
      if (mountedRef.current) {
        setResult(null);
        setPhase("scanning");
      }
    } catch {
      void startScanner();
    }
  }, [startScanner]);

  const toggleTorch = useCallback(async (): Promise<void> => {
    const scanner = scannerRef.current;
    if (!scanner || busyRef.current) {
      return;
    }
    try {
      const torch = scanner.getRunningTrackCameraCapabilities().torchFeature();
      if (!torch.isSupported()) {
        setTorchSupported(false);
        return;
      }
      const next = !torchOn;
      await torch.apply(next);
      if (mountedRef.current) {
        setTorchOn(next);
      }
    } catch {
      if (mountedRef.current) {
        setTorchSupported(false);
        setTorchOn(false);
      }
    }
  }, [torchOn]);

  const switchCamera = useCallback(async (): Promise<void> => {
    if (cameras.length < 2 || busyRef.current) {
      return;
    }
    const currentId = activeCameraRef.current;
    const currentIndex = cameras.findIndex((camera) => camera.id === currentId);
    const next = cameras[(currentIndex + 1) % cameras.length];
    if (!next?.id || next.id === currentId) {
      return;
    }
    await stopScanner();
    await startScanner(next.id);
  }, [cameras, startScanner, stopScanner]);

  const runOcrCapture = useCallback(async (): Promise<void> => {
    if (ocrBusy || lockRef.current) {
      return;
    }
    const frame = captureVideoFrame();
    if (!frame) {
      setOcrMessage(t("terminal.ocrFailed"));
      return;
    }
    setOcrBusy(true);
    setOcrMessage(null);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      try {
        const recognize = worker.recognize(frame);
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("OCR_TIMEOUT")), OCR_TIMEOUT_MS),
        );
        const result = await Promise.race([recognize, timeout]);
        const text: string =
          (result as { data?: { text?: string } }).data?.text ?? "";
        const identifiers = extractIdentifiers(text);
        if (identifiers.length === 0) {
          setOcrMessage(t("terminal.ocrNoIdentifiers"));
          return;
        }
        const at = Date.now();
        lockRef.current = true;
        const scan: ScanResult = {
          payload: identifiers
            .map((identifier) => identifier.value)
            .join(" · "),
          format: OCR_FORMAT,
          timestamp: at,
          method: "camera_ocr",
        };
        const scanner = scannerRef.current;
        if (scanner) {
          try {
            scanner.pause(true);
          } catch {
            // scanner was not pausable; result still surfaces below
          }
        }
        setResult(scan);
        signalHit();
        if (mountedRef.current) {
          setPhase("scanned");
        }
        completionRef.current(scan);
      } finally {
        await worker.terminate().catch(() => undefined);
      }
    } catch {
      if (mountedRef.current) {
        setOcrMessage(t("terminal.ocrFailed"));
      }
    } finally {
      if (mountedRef.current) {
        setOcrBusy(false);
      }
    }
  }, [ocrBusy, signalHit, t]);

  const submitManual = useCallback(
    (event: FormEvent<HTMLFormElement>): void => {
      event.preventDefault();
      const payload = manualValue.trim();
      if (!payload) {
        return;
      }

      const scan: ScanResult = {
        payload,
        format: MANUAL_FORMAT,
        timestamp: Date.now(),
        method: "keyboard",
      };
      const scanner = scannerRef.current;
      if (scanner) {
        try {
          scanner.pause(true);
        } catch {
          setPhase("scanned");
        }
      }
      lockRef.current = true;
      seenRef.current = { payload, at: scan.timestamp };
      setResult(scan);
      setFault(null);
      setManualValue("");
      signalHit();
      if (mountedRef.current) {
        setPhase("scanned");
      }
      completionRef.current(scan);
    },
    [manualValue, signalHit],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void releaseCamera();
      const audio = audioRef.current;
      audioRef.current = null;
      if (audio && audio.state !== "closed") {
        void audio.close().catch(() => undefined);
      }
    };
  }, [releaseCamera]);

  const isBusy = phase === "requesting_permission";
  const showFeed = cameraLive || phase === "scanned";

  const statusLabel =
    phase === "idle"
      ? t("terminal.phaseIdle")
      : phase === "requesting_permission"
        ? t("terminal.phaseRequesting")
        : phase === "scanning"
          ? t("terminal.phaseScanning")
          : phase === "scanned"
            ? t("terminal.phaseScanned")
            : t("terminal.phaseError");

  const statusColor =
    phase === "scanned"
      ? "var(--success)"
      : phase === "error"
        ? "var(--danger)"
        : phase === "idle"
          ? "var(--muted)"
          : "var(--accent)";

  const payloadReadout = result ? result.payload : t("terminal.ready");

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-line/40 bg-panel shadow-[var(--shadow)]">
      <header className="flex items-center justify-between gap-3 border-b border-line/40 bg-header px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            className={`grid h-9 w-9 place-items-center rounded-xl border border-accent/40 bg-inset text-accent ${
              phase === "scanning" ? "animate-pulse" : ""
            }`}
          >
            <ScanLine className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
              {t("terminal.eyebrow")}
            </p>
            <h2 className="text-sm font-semibold text-ink">{t("terminal.bay")}</h2>
          </div>
        </div>
        <span className="rounded-lg border border-line/60 bg-inset px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
          {t("terminal.chip")}
        </span>
      </header>

      <div className="flex flex-col gap-4 p-5">
        <div className="relative h-[248px] overflow-hidden rounded-xl border border-line/60 bg-inset">
          <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(123,208,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(123,208,255,0.06)_1px,transparent_1px)] [background-size:26px_26px]" />

          <div
            id={READER_ELEMENT_ID}
            className="relative h-full w-full [&>div]:hidden! [&_video]:block [&_video]:h-full! [&_video]:w-full! [&_video]:object-cover"
          />

          {!showFeed && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="flex flex-col items-center gap-2 px-6 text-center">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-line/60 bg-header text-faint">
                  {phase === "error" ? (
                    <TriangleAlert className="h-5 w-5" aria-hidden="true" />
                  ) : isBusy ? (
                    <LoaderCircle className="h-5 w-5 animate-spin text-accent" aria-hidden="true" />
                  ) : (
                    <ScanBarcode className="h-5 w-5" aria-hidden="true" />
                  )}
                </span>
                <p className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.2em] text-muted">
                  {isBusy
                    ? t("terminal.offlineBusy")
                    : phase === "error"
                      ? t("terminal.offlineError")
                      : t("terminal.offlineIdle")}
                </p>
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute inset-0">
            <span
              className={`absolute h-6 w-6 border-accent transition-opacity duration-300 ${
                showFeed ? "opacity-90" : "opacity-30"
              }`}
              style={{ top: 14, left: 14, borderTopWidth: 2, borderLeftWidth: 2 }}
              aria-hidden="true"
            />
            <span
              className={`absolute h-6 w-6 border-accent transition-opacity duration-300 ${
                showFeed ? "opacity-90" : "opacity-30"
              }`}
              style={{ top: 14, right: 14, borderTopWidth: 2, borderRightWidth: 2 }}
              aria-hidden="true"
            />
            <span
              className={`absolute h-6 w-6 border-accent transition-opacity duration-300 ${
                showFeed ? "opacity-90" : "opacity-30"
              }`}
              style={{ bottom: 14, left: 14, borderBottomWidth: 2, borderLeftWidth: 2 }}
              aria-hidden="true"
            />
            <span
              className={`absolute h-6 w-6 border-accent transition-opacity duration-300 ${
                showFeed ? "opacity-90" : "opacity-30"
              }`}
              style={{ bottom: 14, right: 14, borderBottomWidth: 2, borderRightWidth: 2 }}
              aria-hidden="true"
            />
          </div>

          {phase === "scanning" && (
            <div
              className="pointer-events-none absolute inset-0 overflow-hidden"
              aria-hidden="true"
            >
              <div className="optical-sweep absolute inset-x-0 h-px bg-accent shadow-[0_0_14px_3px_rgba(123,208,255,0.75)]" />
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    phase === "scanning" || phase === "requesting_permission"
                      ? "animate-pulse"
                      : ""
                  }`}
                  style={{ backgroundColor: statusColor }}
                />
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.2em]"
                  style={{ color: statusColor }}
                  aria-live="polite"
                >
                  {statusLabel}
                </span>
              </div>
              <span
                className={`rounded-lg border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
                  result
                    ? "border-success/40 bg-success/10 text-success"
                    : "border-line/60 bg-inset text-muted"
                }`}
              >
                {result ? result.format : t("terminal.noSignal")}
              </span>
            </div>

            <div className="space-y-1.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                {t("terminal.rawPayload")}
              </p>
              <p
                className={`font-mono text-lg font-semibold leading-snug tracking-[0.06em] break-all ${
                  result ? "text-accent" : "text-faint"
                }`}
              >
                {payloadReadout}
              </p>
              {result && (
                <p className="font-mono text-[11px] tracking-[0.06em] text-muted">
                  {formatTimestamp(new Date(result.timestamp))}
                </p>
              )}
            </div>
          </div>
        </div>

        {fault && (
          <div className="flex items-start gap-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3">
            <TriangleAlert
              className="mt-0.5 h-4 w-4 shrink-0 text-danger"
              aria-hidden="true"
            />
            <div className="min-w-0 space-y-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-danger">
                {t(`terminal.fault.${fault.code}`)}
              </p>
              <p className="font-mono text-[10px] leading-relaxed break-all text-muted">
                {fault.detail}
              </p>
            </div>
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-3 rounded-xl border border-line/50 bg-inset p-4">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-success/50 bg-success/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-success">
              <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {t("terminal.sealed")}
            </span>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <ReadoutCell label={t("terminal.format")} value={result.format} />
              <ReadoutCell
                label={t("terminal.source")}
                value={
                  result.format === MANUAL_FORMAT
                    ? t("terminal.manualEntry")
                    : t("terminal.cameraStream")
                }
              />
              <ReadoutCell
                label={t("terminal.captured")}
                value={formatTimestamp(new Date(result.timestamp))}
              />
              <ReadoutCell label={t("terminal.hardwareId")} value={hardware} />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={ocrBusy || phase === "requesting_permission"}
            onClick={() => {
              if (cameraLive && phase !== "scanned") {
                void runOcrCapture();
              } else {
                manualInputRef.current?.focus();
              }
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel disabled:cursor-not-allowed disabled:opacity-70"
          >
            {ocrBusy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ScanLine className="h-4 w-4" aria-hidden="true" />
            )}
            {ocrBusy ? t("terminal.ocrBusy") : t("terminal.scanAction")}
          </button>
          {ocrMessage && (
            <p className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-danger">
              {ocrMessage}
            </p>
          )}

          {(phase === "idle" ||
            phase === "error" ||
            (phase === "scanned" && !cameraLive)) && (
            <button
              type="button"
              onClick={() => void startScanner()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel disabled:cursor-not-allowed disabled:opacity-70"
            >
              {phase === "error" ? (
                <RotateCw className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4" aria-hidden="true" />
              )}
              {phase === "error" ? t("terminal.retryCamera") : t("terminal.startCamera")}
            </button>
          )}

          {phase === "requesting_permission" && (
            <button
              type="button"
              disabled
              className="flex w-full cursor-wait items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white opacity-70"
            >
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t("terminal.requestingAccess")}
            </button>
          )}

          {(phase === "scanning" || (phase === "scanned" && cameraLive)) && (
            <div className="flex gap-2">
              {phase === "scanned" && (
                <button
                  type="button"
                  onClick={resumeScanner}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                >
                  <RotateCw className="h-4 w-4" aria-hidden="true" />
                  {t("terminal.scanNext")}
                </button>
              )}
              <button
                type="button"
                onClick={() => void stopScanner()}
                className={`flex items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-semibold text-ink transition-colors hover:border-accent/60 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel ${
                  phase === "scanning" ? "w-full" : "flex-1"
                }`}
              >
                <Square className="h-4 w-4" aria-hidden="true" />
                {t("terminal.stopCamera")}
              </button>
            </div>
          )}

          {cameraLive && (torchSupported || cameras.length > 1) && (
            <div className="grid grid-cols-2 gap-2">
              {torchSupported && (
                <button
                  type="button"
                  onClick={() => void toggleTorch()}
                  aria-pressed={torchOn}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    torchOn
                      ? "border-accent/60 bg-inset text-accent"
                      : "border-line text-muted hover:border-accent/50 hover:text-accent"
                  }`}
                >
                  {torchOn ? (
                    <FlashlightOff className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Flashlight className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {torchOn ? t("terminal.torchOn") : t("terminal.torchOff")}
                </button>
              )}
              {cameras.length > 1 && (
                <button
                  type="button"
                  onClick={() => void switchCamera()}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    torchSupported
                      ? "border-line text-muted hover:border-accent/50 hover:text-accent"
                      : "col-span-2 border-line text-muted hover:border-accent/50 hover:text-accent"
                  }`}
                >
                  <SwitchCamera className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("terminal.switchCamera")}
                </button>
              )}
            </div>
          )}
        </div>

        <form onSubmit={submitManual} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="optical-manual-serial"
              className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted"
            >
              <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
              {t("terminal.manualFallback")}
            </label>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
              {t("terminal.cameraUnavailable")}
            </span>
          </div>
          <div className="flex gap-2">
            <input
              id="optical-manual-serial"
              ref={manualInputRef}
              type="text"
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
              placeholder={t("terminal.ready")}
              autoComplete="off"
              spellCheck={false}
              aria-label={t("terminal.manualLabel")}
              className="min-w-0 flex-1 rounded-xl border border-line/60 bg-inset px-3 py-2.5 font-mono text-xs tracking-[0.06em] text-ink placeholder:text-muted focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/50"
            />
            <button
              type="submit"
              disabled={manualValue.trim().length === 0}
              className="shrink-0 rounded-xl border border-line px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink transition-colors hover:border-accent/60 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("terminal.commit")}
            </button>
          </div>
        </form>

        <p className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-muted">
          {phase === "scanning"
            ? t("terminal.hintScanning")
            : phase === "scanned"
              ? t("terminal.hintScanned")
              : t("terminal.hintIdle")}
        </p>
      </div>
    </section>
  );
}
