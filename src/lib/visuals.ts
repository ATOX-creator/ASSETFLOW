import {
  Boxes,
  HardDrive,
  Headphones,
  Keyboard,
  Laptop,
  MemoryStick,
  Monitor,
  Mouse,
  PlugZap,
  Printer,
  Usb,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AssetCategory, Tone } from "./constants";

export const CATEGORY_ICON: Record<AssetCategory, LucideIcon> = {
  aio: Monitor,
  laptop: Laptop,
  desktop: Monitor,
  monitor: Monitor,
  mouse: Mouse,
  keyboard: Keyboard,
  headset: Headphones,
  ram: MemoryStick,
  ssd: HardDrive,
  hdd: HardDrive,
  printer: Printer,
  docking: Usb,
  charger: PlugZap,
  other: Boxes,
};

export function categoryIcon(category: string): LucideIcon {
  return CATEGORY_ICON[category as AssetCategory] ?? Boxes;
}

export const TONE_DOT: Record<Tone, string> = {
  green: "bg-tone-green",
  blue: "bg-tone-blue",
  orange: "bg-tone-orange",
  red: "bg-tone-red",
  crimson: "bg-tone-crimson",
  gray: "bg-tone-gray",
};

export const TONE_BADGE: Record<Tone, string> = {
  green: "tone-green",
  blue: "tone-blue",
  orange: "tone-orange",
  red: "tone-red",
  crimson: "tone-crimson",
  gray: "tone-gray",
};

export function toneOf(status: string): Tone {
  const known = STATUS_TONES[status];
  return known ?? "gray";
}

const STATUS_TONES: Record<string, Tone> = {
  deployed: "green",
  available: "green",
  retrieved: "blue",
  in_repair: "orange",
  repaired: "blue",
  defective: "red",
  damaged: "red",
  damaged_beyond_repair: "crimson",
  glitching: "orange",
  lost: "gray",
  retired: "gray",
};
