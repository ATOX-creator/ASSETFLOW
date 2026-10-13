import type {
  AssetCategory,
  AssetStatus,
  Department,
} from "@/lib/constants";
import type {
  AssetLogRecord,
  AssetRecord,
  DatabaseSchema,
  PreferencesRecord,
  UserRecord,
} from "./types";

interface SeedUser {
  id: string;
  name: string;
  email: string;
  department: Department;
  role?: "admin" | "member";
}

export const SEED_USERS: readonly SeedUser[] = [
  {
    id: "usr_john_smith",
    name: "John Smith",
    email: "john.smith@company.com",
    department: "it",
    role: "admin",
  },
  {
    id: "usr_sarah_jones",
    name: "Sarah Jones",
    email: "sarah.jones@company.com",
    department: "facilities",
  },
  {
    id: "usr_ahmed_ben_ali",
    name: "Ahmed Ben Ali",
    email: "ahmed.benali@company.com",
    department: "development",
  },
  {
    id: "usr_maria_garcia",
    name: "Maria Garcia",
    email: "maria.garcia@company.com",
    department: "hr",
  },
];

interface SeedAsset {
  tag: string;
  name: string;
  category: AssetCategory;
  status: AssetStatus;
}

export const SEED_ASSETS: readonly SeedAsset[] = [
  { tag: "LAP-00421", name: "Dell Latitude 5440", category: "laptop", status: "deployed" },
  { tag: "LAP-00392", name: "ThinkPad X1 Carbon Gen 11", category: "laptop", status: "in_repair" },
  { tag: "LAP-00517", name: "HP EliteBook 840 G10", category: "laptop", status: "available" },
  { tag: "LAP-00238", name: "Lenovo ThinkPad T14 Gen 3", category: "laptop", status: "retrieved" },
  { tag: "LAP-00604", name: "MacBook Air M3 15\"", category: "laptop", status: "deployed" },
  { tag: "LAP-00119", name: "Dell XPS 15 9520", category: "laptop", status: "retired" },

  { tag: "AIO-00032", name: "Dell OptiPlex 7000 AIO", category: "aio", status: "deployed" },
  { tag: "AIO-00047", name: "HP EliteOne 800 G9", category: "aio", status: "available" },

  { tag: "DES-00114", name: "Dell OptiPlex 7020 Micro", category: "desktop", status: "deployed" },
  { tag: "DES-00158", name: "HP ProDesk 400 G9", category: "desktop", status: "glitching" },
  { tag: "DES-00072", name: "Lenovo ThinkCentre M70q", category: "desktop", status: "available" },

  { tag: "MON-00128", name: "Dell UltraSharp U2723QE", category: "monitor", status: "retrieved" },
  { tag: "MON-00203", name: "LG 27UP850-W", category: "monitor", status: "deployed" },
  { tag: "MON-00166", name: "Samsung ViewFinity S8", category: "monitor", status: "damaged" },
  { tag: "MON-00091", name: "BenQ EW2780Q", category: "monitor", status: "available" },
  { tag: "MON-00245", name: "Dell P2422H", category: "monitor", status: "defective" },

  { tag: "MOU-00831", name: "Logitech MX Master 3S", category: "mouse", status: "available" },
  { tag: "MOU-00744", name: "Logitech M185", category: "mouse", status: "deployed" },
  { tag: "MOU-00902", name: "Razer DeathAdder V3", category: "mouse", status: "available" },
  { tag: "MOU-00655", name: "Dell WM123 Wireless", category: "mouse", status: "lost" },

  { tag: "KEY-00410", name: "Logitech MX Keys S", category: "keyboard", status: "deployed" },
  { tag: "KEY-00388", name: "Keychron K2 Pro", category: "keyboard", status: "available" },
  { tag: "KEY-00455", name: "Dell KB216 Wired", category: "keyboard", status: "available" },

  { tag: "HDS-00212", name: "Jabra Evolve2 65", category: "headset", status: "deployed" },
  { tag: "HDS-00198", name: "Sony WH-1000XM5", category: "headset", status: "available" },
  { tag: "HDS-00264", name: "HyperX Cloud III", category: "headset", status: "damaged_beyond_repair" },

  { tag: "RAM-00561", name: "Kingston Fury 16GB DDR5", category: "ram", status: "available" },
  { tag: "RAM-00620", name: "Crucial 32GB DDR4 SODIMM", category: "ram", status: "deployed" },

  { tag: "SSD-00744", name: "Samsung 990 Pro 2TB", category: "ssd", status: "available" },
  { tag: "SSD-00688", name: "WD Black SN850X 1TB", category: "ssd", status: "deployed" },

  { tag: "HDD-00305", name: "Seagate IronWolf 4TB", category: "hdd", status: "available" },
  { tag: "HDD-00312", name: "Toshiba P300 2TB", category: "hdd", status: "defective" },

  { tag: "PRT-00058", name: "HP LaserJet M404dn", category: "printer", status: "in_repair" },
  { tag: "PRT-00071", name: "Brother HL-L2350DW", category: "printer", status: "deployed" },

  { tag: "DOC-00126", name: "Dell WD19S Dock", category: "docking", status: "deployed" },
  { tag: "DOC-00141", name: "HP USB-C Dock G5", category: "docking", status: "available" },

  { tag: "CHG-00512", name: "Dell 65W USB-C Adapter", category: "charger", status: "available" },
  { tag: "CHG-00498", name: "Lenovo 90W Slim Tip", category: "charger", status: "lost" },
  { tag: "CHG-00533", name: "HP 45W Smart Adapter", category: "charger", status: "repaired" },

  { tag: "OTH-00011", name: "Ubiquiti UDM-Pro", category: "other", status: "deployed" },
  { tag: "OTH-00019", name: "Cisco Catalyst 9200L", category: "other", status: "retrieved" },
  { tag: "OTH-00027", name: "Synology RS1221+", category: "other", status: "available" },
];

interface SeedLog {
  tag: string;
  userId: string;
  at: string;
  status: AssetStatus;
  format?: string;
}

const SEED_LOGS: readonly SeedLog[] = [
  { tag: "LAP-00421", userId: "usr_john_smith", at: "2026-10-07T09:14:00", status: "deployed", format: "QR_CODE" },
  { tag: "MON-00128", userId: "usr_sarah_jones", at: "2026-10-07T09:08:00", status: "retrieved", format: "QR_CODE" },
  { tag: "LAP-00392", userId: "usr_john_smith", at: "2026-10-07T08:52:00", status: "in_repair", format: "MANUAL_INPUT" },
  { tag: "MOU-00831", userId: "usr_ahmed_ben_ali", at: "2026-10-07T08:41:00", status: "available", format: "EAN_13" },
  { tag: "DES-00158", userId: "usr_ahmed_ben_ali", at: "2026-10-07T08:35:00", status: "glitching", format: "QR_CODE" },
  { tag: "HDS-00264", userId: "usr_maria_garcia", at: "2026-10-06T16:45:00", status: "damaged_beyond_repair", format: "QR_CODE" },
  { tag: "PRT-00058", userId: "usr_sarah_jones", at: "2026-10-06T15:22:00", status: "in_repair", format: "MANUAL_INPUT" },
  { tag: "SSD-00744", userId: "usr_john_smith", at: "2026-10-06T14:10:00", status: "available", format: "CODE_128" },
  { tag: "MON-00166", userId: "usr_sarah_jones", at: "2026-10-06T12:30:00", status: "damaged", format: "QR_CODE" },
  { tag: "CHG-00498", userId: "usr_maria_garcia", at: "2026-10-06T11:05:00", status: "lost", format: "EAN_13" },
  { tag: "LAP-00238", userId: "usr_john_smith", at: "2026-10-06T10:18:00", status: "retrieved", format: "QR_CODE" },
  { tag: "DOC-00126", userId: "usr_ahmed_ben_ali", at: "2026-10-06T09:47:00", status: "deployed", format: "CODE_128" },
  { tag: "HDD-00312", userId: "usr_sarah_jones", at: "2026-10-06T09:20:00", status: "defective", format: "QR_CODE" },
  { tag: "AIO-00047", userId: "usr_maria_garcia", at: "2026-10-06T08:58:00", status: "available", format: "MANUAL_INPUT" },
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function minutesBefore(isoLocal: string, minutes: number): string {
  const date = new Date(isoLocal);
  date.setMinutes(date.getMinutes() - minutes);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function createSeedDatabase(): DatabaseSchema {
  const now = new Date().toISOString();
  const createdAt = "2026-10-01T08:00:00.000Z";

  const users: UserRecord[] = SEED_USERS.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    department: user.department,
    role: user.role ?? "member",
    createdAt,
  }));

  const userById = new Map(users.map((user) => [user.id, user]));

  const assets: AssetRecord[] = SEED_ASSETS.map((asset, index) => ({
    id: `ast_${String(index + 1).padStart(4, "0")}`,
    tag: asset.tag,
    name: asset.name,
    category: asset.category,
    status: asset.status,
    location: null,
    createdAt,
    updatedAt: createdAt,
    lastScannedAt: null,
  }));

  const assetByTag = new Map(assets.map((asset) => [asset.tag, asset]));

  const logs: AssetLogRecord[] = [];
  const seen = new Map<string, AssetStatus>();

  const chronological = [...SEED_LOGS].sort((a, b) => a.at.localeCompare(b.at));

  for (const entry of chronological) {
    const asset = assetByTag.get(entry.tag);
    const user = userById.get(entry.userId);
    if (!asset || !user) {
      continue;
    }
    const previous = seen.get(asset.tag) ?? null;
    seen.set(asset.tag, entry.status);
    logs.push({
      id: `log_${asset.tag}_${entry.at.replace(/[^0-9]/g, "")}`,
      assetId: asset.id,
      assetTag: asset.tag,
      assetName: asset.name,
      category: asset.category,
      previousStatus: previous,
      status: entry.status,
      scannedById: user.id,
      scannedByName: user.name,
      scannedByEmail: user.email,
      scannedAt: new Date(entry.at).toISOString(),
      format: entry.format ?? null,
    });
    asset.lastScannedAt = new Date(entry.at).toISOString();
    asset.updatedAt = new Date(entry.at).toISOString();
  }

  logs.sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));

  const preferences: PreferencesRecord[] = users.map((user) => ({
    userId: user.id,
    language: "en",
    theme: "system",
    updatedAt: now,
  }));

  return {
    version: 1,
    users,
    assets,
    logs,
    preferences,
    scanEvents: [],
  };
}

export { minutesBefore };
