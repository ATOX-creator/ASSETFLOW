"use client";

import { Database, LoaderCircle, TriangleAlert } from "lucide-react";

interface Message {
  title: string;
  hint?: string;
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="panel flex items-center justify-center gap-3 px-6 py-16">
      <LoaderCircle className="h-5 w-5 animate-spin text-accent" aria-hidden="true" />
      <p className="eyebrow">{label}</p>
    </div>
  );
}

export function ErrorBlock({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry?: () => void;
}) {
  return (
    <div className="panel flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-xl border border-danger/40 bg-danger/10 text-danger">
        <TriangleAlert className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="max-w-md text-sm font-medium text-ink">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-ghost mt-1">
          {retryLabel}
        </button>
      )}
    </div>
  );
}

export function EmptyBlock({ title, hint }: Message) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <Database className="mb-1 h-6 w-6 text-faint" aria-hidden="true" />
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted">{hint}</p>}
    </div>
  );
}
