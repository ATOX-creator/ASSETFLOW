"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Boxes,
  ChevronDown,
  Clock3,
  Cpu,
  Database,
  Ellipsis,
  HardDrive,
  Monitor,
  Network,
  Search,
  Server,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AssetStatus, ScannedAsset } from "./OpticalScanner";

type StatusFilter = "All" | AssetStatus;

interface AssetLedgerTableProps {
  assets: ScannedAsset[];
  onStatusChange: (id: string, status: AssetStatus) => void;
}

const STATUS_FILTERS: ReadonlyArray<StatusFilter> = ["All", "Verified", "Pending", "Flagged"];

const STATUS_META: Record<AssetStatus, { label: string; className: string }> = {
  Verified: {
    label: "FIPS VERIFIED",
    className: "border-[#4ade80]/40 bg-[#042f1a] text-[#4ade80]",
  },
  Pending: {
    label: "PENDING AUDIT",
    className: "border-[#45464d]/60 bg-[#040e20] text-[#909097]",
  },
  Flagged: {
    label: "FLAGGED",
    className: "border-[#7bd0ff]/40 bg-[#040e20] text-[#7bd0ff]",
  },
};

const CATEGORY_ICON: Record<string, LucideIcon> = {
  Laptop: Cpu,
  Desktop: Monitor,
  Server: Server,
  Storage: HardDrive,
  Network: Network,
  Display: Monitor,
  Peripheral: Boxes,
  Mobile: Smartphone,
};

const MENU_ACTIONS: ReadonlyArray<{
  status: AssetStatus;
  label: string;
  icon: LucideIcon;
}> = [
  { status: "Verified", label: "Mark FIPS Verified", icon: ShieldCheck },
  { status: "Pending", label: "Queue Pending Audit", icon: Clock3 },
  { status: "Flagged", label: "Flag For Review", icon: TriangleAlert },
];

export default function AssetLedgerTable({
  assets,
  onStatusChange,
}: AssetLedgerTableProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const filteredAssets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return assets.filter((asset) => {
      if (statusFilter !== "All" && asset.status !== statusFilter) {
        return false;
      }
      if (needle.length === 0) {
        return true;
      }
      return (
        asset.serial.toLowerCase().includes(needle) ||
        asset.name.toLowerCase().includes(needle) ||
        asset.category.toLowerCase().includes(needle)
      );
    });
  }, [assets, query, statusFilter]);

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

  const selectAction = (id: string, status: AssetStatus): void => {
    onStatusChange(id, status);
    setOpenMenuId(null);
  };

  return (
    <section className="flex flex-col overflow-x-auto rounded-2xl border border-[#45464d]/40 bg-[#152032] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]">
      <header className="flex min-w-[760px] flex-wrap items-center justify-between gap-3 border-b border-[#45464d]/40 bg-[#111c2e] px-5 py-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#909097]">
            Asset Ledger
          </p>
          <h2 className="text-sm font-semibold text-white">Tracked Hardware Inventory</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#909097]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search serial, asset, category…"
              aria-label="Search asset ledger"
              className="w-[240px] rounded-xl border border-[#45464d]/60 bg-[#040e20] py-2 pl-9 pr-3 font-mono text-xs text-white placeholder:text-[#909097] focus:border-[#7bd0ff]/60 focus:outline-none focus:ring-1 focus:ring-[#7bd0ff]/50"
            />
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              aria-label="Filter by verification status"
              className="appearance-none rounded-xl border border-[#45464d]/60 bg-[#040e20] py-2 pl-3 pr-9 font-mono text-xs text-white focus:border-[#7bd0ff]/60 focus:outline-none focus:ring-1 focus:ring-[#7bd0ff]/50"
            >
              {STATUS_FILTERS.map((option) => (
                <option key={option} value={option} className="bg-[#040e20] text-white">
                  {option === "All" ? "All Statuses" : STATUS_META[option].label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#909097]"
              aria-hidden="true"
            />
          </div>
        </div>
      </header>

      <div className="min-w-[760px]">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Ledger of scanned hardware assets with verification status
          </caption>
          <thead>
            <tr className="bg-[#152032]">
              <th
                scope="col"
                className="px-5 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#909097]"
              >
                Serial ID
              </th>
              <th
                scope="col"
                className="px-5 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#909097]"
              >
                Asset Name
              </th>
              <th
                scope="col"
                className="px-5 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#909097]"
              >
                Category
              </th>
              <th
                scope="col"
                className="px-5 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#909097]"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-5 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#909097]"
              >
                Last Scan
              </th>
              <th scope="col" className="px-5 py-3">
                <span className="sr-only">Row actions</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredAssets.length === 0 && (
              <tr className="bg-[#111c2e]">
                <td colSpan={6} className="px-5 py-12 text-center">
                  <Database
                    className="mx-auto mb-3 h-6 w-6 text-[#45464d]"
                    aria-hidden="true"
                  />
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#909097]">
                    No records match the active filter
                  </p>
                </td>
              </tr>
            )}

            {filteredAssets.map((asset, index) => {
              const meta = STATUS_META[asset.status];
              const CategoryIcon = CATEGORY_ICON[asset.category] ?? Boxes;
              const isMenuOpen = openMenuId === asset.id;
              const isLastRow = index === filteredAssets.length - 1;

              return (
                <tr
                  key={asset.id}
                  className="border-t border-[#45464d]/30 bg-[#111c2e] transition-colors hover:bg-[#152032]"
                >
                  <td className="max-w-[300px] px-5 py-3 font-mono text-[13px] tracking-[0.04em] break-all text-[#7bd0ff]">
                    {asset.serial}
                  </td>
                  <td className="max-w-[280px] px-5 py-3 text-sm font-medium break-words text-white">
                    {asset.name}
                  </td>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2 text-[13px] text-[#909097]">
                      <CategoryIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      {asset.category}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${meta.className}`}
                    >
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-[12px] text-[#909097]">
                    {asset.lastScan}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div ref={isMenuOpen ? menuRef : undefined} className="relative inline-block">
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(isMenuOpen ? null : asset.id)}
                        aria-haspopup="menu"
                        aria-expanded={isMenuOpen}
                        aria-label={`Actions for ${asset.serial}`}
                        className="grid h-8 w-8 place-items-center rounded-xl border border-[#45464d]/50 bg-[#040e20] text-[#909097] transition-colors hover:border-[#7bd0ff]/50 hover:text-[#7bd0ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7bd0ff]"
                      >
                        <Ellipsis className="h-4 w-4" aria-hidden="true" />
                      </button>

                      {isMenuOpen && (
                        <div
                          role="menu"
                          className={`absolute right-0 z-20 w-52 overflow-hidden rounded-xl border border-[#45464d]/60 bg-[#152032] py-1 shadow-[0_16px_32px_-12px_rgba(0,0,0,0.85)] ${
                            isLastRow ? "bottom-full mb-1" : "top-full mt-1"
                          }`}
                        >
                          {MENU_ACTIONS.map(({ status, label, icon: ActionIcon }) => (
                            <button
                              key={status}
                              type="button"
                              role="menuitem"
                              onClick={() => selectAction(asset.id, status)}
                              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-[#111c2e] ${
                                asset.status === status
                                  ? "text-[#7bd0ff]"
                                  : "text-[#909097]"
                              }`}
                            >
                              <ActionIcon className="h-3.5 w-3.5" aria-hidden="true" />
                              {label}
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

      <footer className="flex min-w-[760px] flex-wrap items-center justify-between gap-2 border-t border-[#45464d]/40 bg-[#111c2e] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[#909097]">
        <span>
          Showing {filteredAssets.length} of {assets.length} records
        </span>
        <span>Sync cadence 5000ms • Ledger node bay-04</span>
      </footer>
    </section>
  );
}
