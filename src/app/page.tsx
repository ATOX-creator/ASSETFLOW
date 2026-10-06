"use client";

import { useCallback, useState } from "react";
import { ScanLine } from "lucide-react";
import OpticalScanner, {
  createAssetFromScan,
  type AssetStatus,
  type ScanResult,
  type ScannedAsset,
} from "@/components/OpticalScanner";
import AssetLedgerTable from "@/components/AssetLedgerTable";

const SEED_ASSETS: ReadonlyArray<ScannedAsset> = [
  {
    id: "seed-001",
    serial: "SN-HW-849201",
    name: "ThinkPad X1 Carbon Gen 11",
    category: "Laptop",
    status: "Verified",
    lastScan: "2026-10-06 08:12:44",
  },
  {
    id: "seed-002",
    serial: "SN-HW-730158",
    name: "HPE ProLiant DL360 Gen11",
    category: "Server",
    status: "Verified",
    lastScan: "2026-10-06 08:19:07",
  },
  {
    id: "seed-003",
    serial: "SN-HW-556420",
    name: "Ubiquiti UDM-Pro",
    category: "Network",
    status: "Pending",
    lastScan: "2026-10-06 08:31:55",
  },
  {
    id: "seed-004",
    serial: "SN-HW-118974",
    name: "Samsung 990 Pro 2TB",
    category: "Storage",
    status: "Verified",
    lastScan: "2026-10-06 08:47:13",
  },
  {
    id: "seed-005",
    serial: "SN-HW-402386",
    name: "Dell UltraSharp U2723QE",
    category: "Display",
    status: "Flagged",
    lastScan: "2026-10-06 09:02:38",
  },
  {
    id: "seed-006",
    serial: "SN-HW-967512",
    name: "Dell OptiPlex 7020 Micro",
    category: "Desktop",
    status: "Pending",
    lastScan: "2026-10-06 09:15:26",
  },
];

export default function Home() {
  const [assets, setAssets] = useState<ScannedAsset[]>(() => [...SEED_ASSETS]);

  const handleScanComplete = useCallback((scan: ScanResult) => {
    const incoming = createAssetFromScan(scan);
    setAssets((previous) => {
      const index = previous.findIndex(
        (asset) => asset.serial.toLowerCase() === incoming.serial.toLowerCase(),
      );
      if (index < 0) {
        return [incoming, ...previous];
      }
      const merged = [...previous];
      const [existing] = merged.splice(index, 1);
      if (!existing) {
        return previous;
      }
      return [{ ...existing, lastScan: incoming.lastScan }, ...merged];
    });
  }, []);

  const handleStatusChange = useCallback((id: string, status: AssetStatus) => {
    setAssets((previous) =>
      previous.map((asset) => (asset.id === id ? { ...asset, status } : asset)),
    );
  }, []);

  return (
    <div className="min-h-screen bg-[#081325] font-sans text-white">
      <header className="sticky top-0 z-30 border-b border-[#45464d]/40 bg-[#040e20]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-[#7bd0ff]/40 bg-[#081325] text-[#7bd0ff]">
              <ScanLine className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#909097]">
                Assetflow Optical Verification
              </p>
              <h1 className="text-lg font-semibold tracking-tight text-white">
                BAY 4 INTAKE
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl border border-[#45464d]/60 bg-[#111c2e] px-3 py-1.5 font-mono text-[11px] tracking-[0.1em] text-[#909097]">
              v1.0.0
            </span>
            <span className="flex items-center gap-2 rounded-xl border border-[#4ade80]/40 bg-[#042f1a] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[#4ade80]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4ade80] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4ade80]" />
              </span>
              Gateway Online
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] items-start gap-6 px-4 py-6 sm:px-6 lg:px-8 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <OpticalScanner onScanComplete={handleScanComplete} />
        <AssetLedgerTable assets={assets} onStatusChange={handleStatusChange} />
      </main>
    </div>
  );
}
