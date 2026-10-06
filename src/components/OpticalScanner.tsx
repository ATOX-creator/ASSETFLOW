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

export type AssetStatus = "Verified" | "Pending" | "Flagged";

export interface ScannedAsset {
  id: string;
  serial: string;
  name: string;
  category: string;
  status: AssetStatus;
  lastScan: string;
}

export interface ScanResult {
  payload: string;
  format: string;
  timestamp: number;
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

interface CameraFault {
  message: string;
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

const CATALOG: ReadonlyArray<{ name: string; category: string }> = [
  { name: "ThinkPad X1 Carbon Gen 11", category: "Laptop" },
  { name: "Dell OptiPlex 7020 Micro", category: "Desktop" },
  { name: "HPE ProLiant DL360 Gen11", category: "Server" },
  { name: "Samsung 990 Pro 2TB", category: "Storage" },
  { name: "Ubiquiti UDM-Pro", category: "Network" },
  { name: "Dell UltraSharp U2723QE", category: "Display" },
  { name: "Logitech MX Keys S", category: "Peripheral" },
  { name: "Synology RS1221+", category: "Storage" },
  { name: "Cisco Catalyst 9200L", category: "Network" },
];

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `asset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function hashPayload(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function resolveAssetMeta(payload: string): {
  name: string;
  category: string;
} {
  const value = payload.trim();
  if (!value) {
    return { name: "Unidentified Asset", category: "Peripheral" };
  }
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return { name: url.hostname.replace(/^www\./, ""), category: "Network" };
    } catch {
      return CATALOG[hashPayload(value) % CATALOG.length];
    }
  }
  return CATALOG[hashPayload(value) % CATALOG.length];
}

export function createAssetFromScan(scan: ScanResult): ScannedAsset {
  const meta = resolveAssetMeta(scan.payload);
  return {
    id: generateId(),
    serial: scan.payload.trim() || "SN-HW-UNKNOWN",
    name: meta.name,
    category: meta.category,
    status: "Verified",
    lastScan: formatTimestamp(new Date(scan.timestamp)),
  };
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
    return {
      message: "Camera permission denied by the browser",
      detail: source,
    };
  }
  if (
    text.includes("notfounderror") ||
    text.includes("requested device not found") ||
    text.includes("no video capture devices") ||
    text.includes("no camera")
  ) {
    return {
      message: "No camera device detected on this terminal",
      detail: source,
    };
  }
  if (
    text.includes("notreadableerror") ||
    text.includes("could not start video source") ||
    text.includes("in use") ||
    text.includes("aborterror")
  ) {
    return {
      message: "Camera hardware is busy in another application",
      detail: source,
    };
  }
  if (text.includes("insecure") || text.includes("secure context")) {
    return {
      message: "Camera requires an https or localhost secure context",
      detail: source,
    };
  }
  if (text.includes("notsupported") || text.includes("navigator.mediadevices")) {
    return {
      message: "Camera streaming is unsupported by this browser",
      detail: source,
    };
  }
  return { message: "Camera failed to initialise the optical intake", detail: source };
}

function ReadoutCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#909097]">
        {label}
      </p>
      <p className="font-mono text-[12px] leading-snug tracking-[0.04em] break-all text-white">
        {value}
      </p>
    </div>
  );
}

export default function OpticalScanner({ onScanComplete }: OpticalScannerProps) {
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [fault, setFault] = useState<CameraFault | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [cameraLive, setCameraLive] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [hardware, setHardware] = useState("STANDBY");

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

      const scan: ScanResult = {
        payload,
        format: decoded.result.format?.formatName ?? "UNKNOWN",
        timestamp: at,
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
          label: device.label || `Camera input ${index + 1}`,
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
  }, []);

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
      ? "LASER IDLE — CAMERA OFF"
      : phase === "requesting_permission"
        ? "AWAITING CAMERA PERMISSION"
        : phase === "scanning"
          ? "SCANNING — DECODER ACTIVE"
          : phase === "scanned"
            ? "SCAN LOCKED — PAYLOAD CAPTURED"
            : "CAMERA FAULT — ACCESS BLOCKED";

  const statusColor =
    phase === "scanned"
      ? "#4ade80"
      : phase === "error"
        ? "#f87171"
        : phase === "idle"
          ? "#909097"
          : "#7bd0ff";

  const payloadReadout = result ? result.payload : "———— awaiting payload ————";

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-[#45464d]/40 bg-[#152032] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]">
      <header className="flex items-center justify-between gap-3 border-b border-[#45464d]/40 bg-[#111c2e] px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            className={`grid h-9 w-9 place-items-center rounded-xl border border-[#7bd0ff]/40 bg-[#040e20] text-[#7bd0ff] ${
              phase === "scanning" ? "animate-pulse" : ""
            }`}
          >
            <ScanLine className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#909097]">
              Optical Verification Terminal
            </p>
            <h2 className="text-sm font-semibold text-white">Scanner Bay</h2>
          </div>
        </div>
        <span className="rounded-lg border border-[#45464d]/60 bg-[#040e20] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[#7bd0ff]">
          BAY 04 • OPTICAL INTAKE
        </span>
      </header>

      <div className="flex flex-col gap-4 p-5">
        <div className="relative h-[248px] overflow-hidden rounded-xl border border-[#45464d]/60 bg-[#040e20]">
          <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(123,208,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(123,208,255,0.06)_1px,transparent_1px)] [background-size:26px_26px]" />

          <div
            id={READER_ELEMENT_ID}
            className="relative h-full w-full [&>div]:hidden! [&_video]:block [&_video]:h-full! [&_video]:w-full! [&_video]:object-cover"
          />

          {!showFeed && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="flex flex-col items-center gap-2 px-6 text-center">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-[#45464d]/60 bg-[#111c2e] text-[#45464d]">
                  {phase === "error" ? (
                    <TriangleAlert className="h-5 w-5" aria-hidden="true" />
                  ) : isBusy ? (
                    <LoaderCircle className="h-5 w-5 animate-spin text-[#7bd0ff]" aria-hidden="true" />
                  ) : (
                    <ScanBarcode className="h-5 w-5" aria-hidden="true" />
                  )}
                </span>
                <p className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.2em] text-[#909097]">
                  {isBusy
                    ? "Requesting camera stream…"
                    : phase === "error"
                      ? "Optical intake offline"
                      : "Camera stream offline"}
                </p>
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute inset-0">
            <span
              className={`absolute h-6 w-6 border-[#7bd0ff] transition-opacity duration-300 ${
                showFeed ? "opacity-90" : "opacity-30"
              }`}
              style={{ top: 14, left: 14, borderTopWidth: 2, borderLeftWidth: 2 }}
              aria-hidden="true"
            />
            <span
              className={`absolute h-6 w-6 border-[#7bd0ff] transition-opacity duration-300 ${
                showFeed ? "opacity-90" : "opacity-30"
              }`}
              style={{ top: 14, right: 14, borderTopWidth: 2, borderRightWidth: 2 }}
              aria-hidden="true"
            />
            <span
              className={`absolute h-6 w-6 border-[#7bd0ff] transition-opacity duration-300 ${
                showFeed ? "opacity-90" : "opacity-30"
              }`}
              style={{ bottom: 14, left: 14, borderBottomWidth: 2, borderLeftWidth: 2 }}
              aria-hidden="true"
            />
            <span
              className={`absolute h-6 w-6 border-[#7bd0ff] transition-opacity duration-300 ${
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
              <div className="optical-sweep absolute inset-x-0 h-px bg-[#7bd0ff] shadow-[0_0_14px_3px_rgba(123,208,255,0.75)]" />
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
                    ? "border-[#4ade80]/40 bg-[#042f1a] text-[#4ade80]"
                    : "border-[#45464d]/60 bg-[#040e20] text-[#909097]"
                }`}
              >
                {result ? result.format : "NO SIGNAL"}
              </span>
            </div>

            <div className="space-y-1.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#909097]">
                Raw payload
              </p>
              <p
                className={`font-mono text-lg font-semibold leading-snug tracking-[0.06em] break-all ${
                  result ? "text-[#7bd0ff]" : "text-[#45464d]"
                }`}
              >
                {payloadReadout}
              </p>
              <p className="font-mono text-[11px] tracking-[0.06em] text-[#909097]">
                {result ? formatTimestamp(new Date(result.timestamp)) : "————-——-—— ——:——:——"}
              </p>
            </div>
          </div>
        </div>

        {fault && (
          <div className="flex items-start gap-3 rounded-xl border border-[#f87171]/40 bg-[#2a0f14] px-4 py-3">
            <TriangleAlert
              className="mt-0.5 h-4 w-4 shrink-0 text-[#f87171]"
              aria-hidden="true"
            />
            <div className="min-w-0 space-y-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#f87171]">
                {fault.message}
              </p>
              <p className="font-mono text-[10px] leading-relaxed break-all text-[#909097]">
                {fault.detail}
              </p>
            </div>
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-3 rounded-xl border border-[#45464d]/50 bg-[#040e20] p-4">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-[#4ade80]/50 bg-[#042f1a] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#4ade80]">
              <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Payload sealed to ledger
            </span>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <ReadoutCell label="Format" value={result.format} />
              <ReadoutCell
                label="Source"
                value={result.format === MANUAL_FORMAT ? "MANUAL ENTRY" : "CAMERA STREAM"}
              />
              <ReadoutCell
                label="Captured"
                value={formatTimestamp(new Date(result.timestamp))}
              />
              <ReadoutCell label="Hardware ID" value={hardware} />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {(phase === "idle" ||
            phase === "error" ||
            (phase === "scanned" && !cameraLive)) && (
            <button
              type="button"
              onClick={() => void startScanner()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0053db] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0051d5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7bd0ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#152032] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {phase === "error" ? (
                <RotateCw className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4" aria-hidden="true" />
              )}
              {phase === "error" ? "Retry Camera Access" : "Start Camera Scanner"}
            </button>
          )}

          {phase === "requesting_permission" && (
            <button
              type="button"
              disabled
              className="flex w-full cursor-wait items-center justify-center gap-2 rounded-xl bg-[#0053db] px-4 py-3 text-sm font-semibold text-white opacity-70"
            >
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              Requesting Camera Access…
            </button>
          )}

          {(phase === "scanning" || (phase === "scanned" && cameraLive)) && (
            <div className="flex gap-2">
              {phase === "scanned" && (
                <button
                  type="button"
                  onClick={resumeScanner}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0053db] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0051d5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7bd0ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#152032]"
                >
                  <RotateCw className="h-4 w-4" aria-hidden="true" />
                  Scan Next
                </button>
              )}
              <button
                type="button"
                onClick={() => void stopScanner()}
                className={`flex items-center justify-center gap-2 rounded-xl border border-[#45464d] px-4 py-3 text-sm font-semibold text-white transition-colors hover:border-[#7bd0ff]/60 hover:text-[#7bd0ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7bd0ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#152032] ${
                  phase === "scanning" ? "w-full" : "flex-1"
                }`}
              >
                <Square className="h-4 w-4" aria-hidden="true" />
                Stop Camera
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
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7bd0ff] ${
                    torchOn
                      ? "border-[#7bd0ff]/60 bg-[#040e20] text-[#7bd0ff]"
                      : "border-[#45464d] text-[#909097] hover:border-[#7bd0ff]/50 hover:text-[#7bd0ff]"
                  }`}
                >
                  {torchOn ? (
                    <FlashlightOff className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Flashlight className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {torchOn ? "Torch On" : "Toggle Flashlight"}
                </button>
              )}
              {cameras.length > 1 && (
                <button
                  type="button"
                  onClick={() => void switchCamera()}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7bd0ff] ${
                    torchSupported
                      ? "border-[#45464d] text-[#909097] hover:border-[#7bd0ff]/50 hover:text-[#7bd0ff]"
                      : "col-span-2 border-[#45464d] text-[#909097] hover:border-[#7bd0ff]/50 hover:text-[#7bd0ff]"
                  }`}
                >
                  <SwitchCamera className="h-3.5 w-3.5" aria-hidden="true" />
                  Switch Camera
                </button>
              )}
            </div>
          )}
        </div>

        <form onSubmit={submitManual} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="optical-manual-serial"
              className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#909097]"
            >
              <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
              Manual fallback
            </label>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#45464d]">
              Camera unavailable
            </span>
          </div>
          <div className="flex gap-2">
            <input
              id="optical-manual-serial"
              type="text"
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
              placeholder="SN-HW-••••••"
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-xl border border-[#45464d]/60 bg-[#040e20] px-3 py-2.5 font-mono text-xs tracking-[0.06em] text-white placeholder:text-[#909097] focus:border-[#7bd0ff]/60 focus:outline-none focus:ring-1 focus:ring-[#7bd0ff]/50"
            />
            <button
              type="submit"
              disabled={manualValue.trim().length === 0}
              className="shrink-0 rounded-xl border border-[#45464d] px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white transition-colors hover:border-[#7bd0ff]/60 hover:text-[#7bd0ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7bd0ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#152032] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Commit
            </button>
          </div>
        </form>

        <p className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-[#909097]">
          {phase === "scanning"
            ? "Align QR or 1D/2D barcode inside the reticle • Decoder armed"
            : phase === "scanned"
              ? "Ledger row committed • Camera held on last frame"
              : "Camera stream stays on device • https or localhost required"}
        </p>
      </div>
    </section>
  );
}
