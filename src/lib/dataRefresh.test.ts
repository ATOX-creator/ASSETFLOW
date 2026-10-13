import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCoalescer,
  getDataVersion,
  notifyDataChanged,
  subscribeDataChanged,
} from "./dataRefresh";

describe("dataRefresh bus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("notifies subscribers with the change reason", () => {
    const seen: string[] = [];
    const unsubscribe = subscribeDataChanged((reason) => seen.push(reason));
    notifyDataChanged("scan");
    notifyDataChanged("asset_update");
    unsubscribe();
    notifyDataChanged("import");
    expect(seen).toEqual(["scan", "asset_update"]);
  });

  it("increments the version on every notification", () => {
    const before = getDataVersion();
    notifyDataChanged("manual");
    notifyDataChanged("manual");
    expect(getDataVersion()).toBe(before + 2);
  });

  it("coalesces bursts into a single callback", () => {
    const callback = vi.fn();
    const coalescer = createCoalescer(callback, 400);

    coalescer.schedule();
    coalescer.schedule();
    coalescer.schedule();
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);
    expect(callback).toHaveBeenCalledTimes(1);

    coalescer.schedule();
    vi.advanceTimersByTime(400);
    expect(callback).toHaveBeenCalledTimes(2);
    coalescer.cancel();
  });

  it("cancels a pending callback", () => {
    const callback = vi.fn();
    const coalescer = createCoalescer(callback, 400);
    coalescer.schedule();
    coalescer.cancel();
    vi.advanceTimersByTime(1000);
    expect(callback).not.toHaveBeenCalled();
  });
});
