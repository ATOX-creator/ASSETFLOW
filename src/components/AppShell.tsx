"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Blocks,
  ChevronDown,
  Cloud,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ScanLine,
  ScrollText,
  Settings,
  Terminal,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useApp } from "@/lib/i18n";
import { apiSend } from "@/lib/api/client";
import type { TranslationKey } from "@/lib/i18n";

interface NavItem {
  href: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/scanner", labelKey: "nav.scanner", icon: ScanLine },
  { href: "/log", labelKey: "nav.log", icon: ScrollText },
  { href: "/settings", labelKey: "nav.settings", icon: Settings },
];

const FEATURE_NAV_ITEMS: readonly NavItem[] = [
  { href: "/integrations", labelKey: "nav.integrations", icon: Cloud },
  { href: "/developer", labelKey: "nav.developerMode", icon: Terminal },
];

const PAGE_TITLES: Record<string, TranslationKey> = {
  "/dashboard": "dashboard.title",
  "/scanner": "scanner.title",
  "/log": "log.title",
  "/settings": "settings.title",
  "/assets": "assets.title",
  "/integrations": "integrations.title",
  "/developer": "developer.title",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function NavLink({
  item,
  active,
  collapsed,
  label,
  indent = false,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  label: string;
  indent?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={`group flex items-center gap-3 rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        indent ? "py-2 pl-11 pr-3" : "px-3 py-2.5"
      } ${
        active
          ? "bg-accent-soft text-accent"
          : "text-muted hover:bg-header hover:text-ink"
      }`}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      <span className={`truncate ${collapsed ? "lg:hidden" : ""}`}>{label}</span>
      {active && (
        <span
          className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-accent lg:block"
          aria-hidden="true"
        />
      )}
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { t, user, setUser } = useApp();
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);

  const featuresActive = FEATURE_NAV_ITEMS.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  useEffect(() => {
    if (featuresActive) {
      setFeaturesOpen(true);
    }
  }, [featuresActive]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const handleLogout = useCallback(async () => {
    if (loggingOut) {
      return;
    }
    setLoggingOut(true);
    try {
      await apiSend("/api/auth/logout", "POST");
    } catch {
      // the cookie is cleared client-side by the redirect below regardless
    }
    setUser(null);
    router.replace("/login");
    router.refresh();
  }, [loggingOut, router, setUser]);

  const pageTitle = useMemo(() => {
    const key = PAGE_TITLES[pathname];
    return key ? t(key) : t("app.name");
  }, [pathname, t]);

  const sidebarStyle = {
    "--sidebar": collapsed ? "76px" : "264px",
  } as React.CSSProperties;

  return (
    <div style={sidebarStyle} className="min-h-screen bg-app text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      <aside
        aria-label="Primary"
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-line/40 bg-panel transition-transform duration-200 lg:w-[var(--sidebar)] lg:translate-x-0 lg:transition-[width,transform] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-line/40 px-4 py-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-2xl border border-accent/40 bg-accent-soft">
              <Image
                src="/main-logo.png"
                alt=""
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            </span>
          <div className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
            <p className="eyebrow truncate">{t("app.product")}</p>
            <p className="truncate text-sm font-semibold text-ink">{t("app.name")}</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="ml-auto grid h-9 w-9 place-items-center rounded-xl border border-line/50 text-muted transition-colors hover:text-ink lg:hidden"
            aria-label={t("nav.closeMenu")}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className={`eyebrow px-3 pb-2 ${collapsed ? "lg:hidden" : ""}`}>
            {t("nav.sectionMain")}
          </p>
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <NavLink
                    item={item}
                    active={active}
                    collapsed={collapsed}
                    label={t(item.labelKey)}
                  />
                </li>
              );
            })}
          </ul>

          <ul className="mt-6 flex flex-col gap-1">
            <li>
              <button
                type="button"
                onClick={() => setFeaturesOpen((value) => !value)}
                aria-expanded={featuresOpen}
                aria-controls="drawer-features"
                aria-label={t("nav.sectionFeatures")}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  featuresActive
                    ? "text-ink"
                    : "text-muted hover:bg-header hover:text-ink"
                }`}
              >
                <Blocks className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                <span className={`truncate ${collapsed ? "lg:hidden" : ""}`}>
                  {t("nav.sectionFeatures")}
                </span>
                <ChevronDown
                  className={`ml-auto h-4 w-4 shrink-0 text-faint transition-transform duration-150 ${
                    featuresOpen ? "rotate-180" : ""
                  } ${collapsed ? "lg:hidden" : ""}`}
                  aria-hidden="true"
                />
              </button>
              <ul
                id="drawer-features"
                hidden={!featuresOpen}
                className="flex flex-col gap-1"
              >
                {FEATURE_NAV_ITEMS.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <NavLink
                        item={item}
                        active={active}
                        collapsed={collapsed}
                        label={t(item.labelKey)}
                        indent
                      />
                    </li>
                  );
                })}
              </ul>
            </li>
          </ul>
        </nav>

        <div className="border-t border-line/40 p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line/50 bg-header font-mono text-[11px] font-semibold text-accent">
              {user ? initials(user.name) : "—"}
            </span>
            <div className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}>
              <p className="truncate text-xs font-semibold text-ink">
                {user?.name ?? t("common.unknown")}
              </p>
              <p className="truncate text-[11px] text-muted">{user?.email ?? "—"}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            title={collapsed ? t("nav.logout") : undefined}
            aria-label={collapsed ? t("nav.logout") : undefined}
            className="mt-1 flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-danger transition-colors hover:border-danger/40 hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            <span className={`truncate ${collapsed ? "lg:hidden" : ""}`}>
              {loggingOut ? t("auth.redirecting") : t("nav.logout")}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="mt-1 hidden w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-header hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:flex"
            aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
            title={collapsed ? t("nav.expand") : t("nav.collapse")}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            )}
            <span className={collapsed ? "lg:hidden" : ""}>{t("nav.collapse")}</span>
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      <div className="flex min-h-screen flex-col lg:pl-[var(--sidebar)]">
        <header className="sticky top-0 z-30 border-b border-line/40 bg-panel/95 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line/50 text-muted transition-colors hover:text-ink lg:hidden"
              aria-label={t("nav.openMenu")}
              aria-expanded={mobileOpen}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="min-w-0">
              <p className="eyebrow truncate">{t("app.tagline")}</p>
              <h1 className="truncate text-base font-semibold tracking-tight text-ink">
                {pageTitle}
              </h1>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <span className="hidden rounded-xl border border-line/60 bg-header px-3 py-1.5 font-mono text-[11px] tracking-[0.1em] text-muted sm:inline-flex">
                {t("app.version")}
              </span>
              <span className="flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 px-3 py-1.5 font-mono text-[11px] tracking-[0.1em] text-success">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
                </span>
                <span className="hidden sm:inline">{t("app.gateway")}</span>
              </span>
            </div>
          </div>
        </header>

        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
