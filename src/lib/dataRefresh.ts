"use client";

import { useEffect, useRef } from "react";

export type DataChangeReason = "scan" | "asset_update" | "import" | "manual";

type Listener = (reason: DataChangeReason) => void;

const listeners = new Set<Listener>();
let version = 0;

/**
 * Client-side invalidation bus. The app has no realtime transport today, so
 * mutations announce themselves here and interested views refetch. When a
 * live backend lands (e.g. Supabase realtime), drive this same bus from the
 * subscription callbacks — consumers do not change.
 */
export function notifyDataChanged(reason: DataChangeReason): void {
  version += 1;
  for (const listener of [...listeners]) {
    listener(reason);
  }
}

export function getDataVersion(): number {
  return version;
}

export function subscribeDataChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export interface Coalescer {
  schedule(): void;
  cancel(): void;
}

/**
 * Collapses rapid notifications into a single callback so a burst of events
 * never triggers duplicate refetches.
 */
export function createCoalescer(callback: () => void, delayMs = 400): Coalescer {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    schedule() {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = undefined;
        callback();
      }, delayMs);
    },
    cancel() {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
  };
}

/**
 * Refetch whenever a mutation is announced, coalescing bursts.
 */
export function useDataRefresh(callback: () => void, delayMs = 400): void {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    const coalescer = createCoalescer(() => saved.current(), delayMs);
    const unsubscribe = subscribeDataChanged(() => coalescer.schedule());
    return () => {
      coalescer.cancel();
      unsubscribe();
    };
  }, [delayMs]);
}
