"use client";

import { Lock, Terminal, Wrench } from "lucide-react";
import { useApp } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";

const FUTURE_TOOLS: readonly { icon: typeof Wrench; labelKey: TranslationKey }[] = [
  { icon: Terminal, labelKey: "developer.toolPayload" },
  { icon: Wrench, labelKey: "developer.toolMapping" },
  { icon: Wrench, labelKey: "developer.toolExpressions" },
  { icon: Wrench, labelKey: "developer.toolDryRun" },
];

export default function DeveloperModePage() {
  const { t } = useApp();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <p className="eyebrow">{t("developer.title")}</p>
        <p className="mt-1 text-sm text-muted">{t("developer.subtitle")}</p>
      </div>

      <section className="panel overflow-hidden">
        <header className="flex items-center justify-between gap-3 border-b border-line/40 bg-header px-5 py-4">
          <div className="flex items-center gap-3">
            <Lock className="h-4 w-4 text-accent" aria-hidden="true" />
            <div>
              <p className="eyebrow">{t("developer.protectedTitle")}</p>
              <h2 className="text-sm font-semibold text-ink">
                {t("developer.title")}
              </h2>
            </div>
          </div>
          <span className="badge tone-gray">{t("developer.pendingBadge")}</span>
        </header>

        <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-line/50 bg-inset text-muted">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="max-w-md text-sm leading-relaxed text-muted">
            {t("developer.protectedHint")}
          </p>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <header className="border-b border-line/40 bg-header px-5 py-4">
          <p className="eyebrow">{t("developer.futureTitle")}</p>
          <h2 className="text-sm font-semibold text-ink">
            {t("developer.futureHint")}
          </h2>
        </header>
        <ul className="grid gap-3 p-5 sm:grid-cols-2">
          {FUTURE_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <li
                key={tool.labelKey}
                className="flex items-center gap-3 rounded-xl border border-line/50 bg-inset px-4 py-3 opacity-60"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line/50 bg-panel text-muted">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                  {t(tool.labelKey)}
                </span>
                <span className="badge tone-gray">{t("developer.pendingBadge")}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
