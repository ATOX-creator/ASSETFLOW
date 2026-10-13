"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { dismissToast, subscribeToasts, type ToastItem, type ToastTone } from "@/lib/toast";

const TONE_STYLES: Record<ToastTone, { className: string; Icon: typeof Info }> = {
  success: { className: "border-success/40 bg-success/10 text-success", Icon: CheckCircle2 },
  error: { className: "border-danger/40 bg-danger/10 text-danger", Icon: XCircle },
  info: { className: "border-accent/40 bg-accent-soft text-accent", Icon: Info },
};

export default function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToasts(setToasts), []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[130] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-4 sm:w-[380px]"
    >
      {toasts.map((toast) => {
        const { className, Icon } = TONE_STYLES[toast.tone];
        return (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur ${className}`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{toast.title}</p>
              {toast.description && (
                <p className="mt-1 text-xs leading-relaxed text-muted">{toast.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded-lg p-1 text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
