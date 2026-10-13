export type ToastTone = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

type Listener = (toasts: ToastItem[]) => void;

const MAX_VISIBLE = 4;
const DEFAULT_DURATION_MS = 7000;

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
const timers = new Map<number, number>();

function emit(): void {
  const snapshot = [...toasts];
  for (const listener of listeners) {
    listener(snapshot);
  }
}

export function dismissToast(id: number): void {
  const timer = timers.get(id);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    timers.delete(id);
  }
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

export function pushToast(
  tone: ToastTone,
  title: string,
  description?: string,
  durationMs: number = DEFAULT_DURATION_MS,
): number {
  const id = nextId;
  nextId += 1;
  const item: ToastItem = { id, tone, title, description };
  toasts = [...toasts, item].slice(-MAX_VISIBLE);
  emit();
  if (durationMs > 0) {
    const timer = window.setTimeout(() => dismissToast(id), durationMs);
    timers.set(id, timer);
  }
  return id;
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener([...toasts]);
  return () => {
    listeners.delete(listener);
  };
}
