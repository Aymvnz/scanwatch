"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { ChevronsLeft, ChevronsRight, Building2, X } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { LogoMark } from "./Logo";

interface Props {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: Props) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={clsx("fixed inset-0 z-30 bg-navy/30 transition-opacity lg:hidden", mobileOpen ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={onCloseMobile}
        aria-hidden
      />

      <aside
        aria-label="Primary"
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r border-line bg-white transition-transform duration-200 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:w-[72px]" : "lg:w-[264px]",
        )}
      >
        {/* Brand */}
        <div className={clsx("flex h-16 shrink-0 items-center gap-3 border-b border-line px-4", collapsed && "lg:justify-center lg:px-0")}>
          <LogoMark />
          <div className={clsx("min-w-0 flex-1", collapsed && "lg:hidden")}>
            <div className="text-[17px] font-semibold leading-none tracking-tight text-navy">ScanWatch</div>
            <div className="mt-1 truncate text-[11px] text-muted">Know when your medical AI changes</div>
          </div>
          <button onClick={onCloseMobile} className="rounded-md p-1.5 text-muted hover:bg-canvas lg:hidden" aria-label="Close navigation">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Workspace */}
        <div className={clsx("px-3 pt-4", collapsed && "lg:px-2")}>
          <div
            title="Workspace: Demo Hospital Network"
            className={clsx("flex items-center gap-2.5 rounded-lg border border-line bg-canvas px-3 py-2.5", collapsed && "lg:justify-center lg:px-0")}
          >
            <Building2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <div className={clsx("min-w-0", collapsed && "lg:hidden")}>
              <div className="eyebrow !text-[10px]">Workspace</div>
              <div className="truncate text-[13px] font-medium text-navy">Demo Hospital Network</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="mt-4 flex-1 overflow-y-auto px-3" aria-label="Main">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onCloseMobile}
                    title={collapsed ? label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      collapsed && "lg:justify-center lg:px-0",
                      active ? "bg-primary-soft text-primary" : "text-muted hover:bg-canvas hover:text-navy",
                    )}
                  >
                    <Icon className={clsx("h-[18px] w-[18px] shrink-0", active ? "text-primary" : "text-slate-400 group-hover:text-navy")} aria-hidden />
                    <span className={clsx("truncate", collapsed && "lg:hidden")}>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Profile + collapse */}
        <div className="border-t border-line p-3">
          <div className={clsx("flex items-center gap-3 rounded-lg px-2 py-1.5", collapsed && "lg:justify-center lg:px-0")}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white" aria-hidden>DU</span>
            <div className={clsx("min-w-0", collapsed && "lg:hidden")}>
              <div className="truncate text-[13px] font-medium text-navy">Demo User</div>
              <div className="truncate text-[11px] text-muted">Reviewer · no sign-in needed</div>
            </div>
          </div>
          <button
            onClick={onToggleCollapse}
            className="mt-2 hidden w-full items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-muted hover:bg-canvas hover:text-navy lg:flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
          </button>
        </div>
      </aside>
    </>
  );
}
