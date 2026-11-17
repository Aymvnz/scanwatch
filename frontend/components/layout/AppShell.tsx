"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { BookOpen, CircleHelp, Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { ModelSelector } from "./ModelSelector";
import { SyntheticBadge } from "../ui/SyntheticBadge";
import { LogoMark } from "./Logo";
import { TourHost, openTour } from "../onboarding/Tour";
import { GlossaryHost, openGlossary } from "../onboarding/Glossary";
import { ResetDemoButton } from "./ResetDemo";
import { BackendStatus } from "./BackendStatus";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const iconBtn = "inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted hover:bg-white hover:text-navy";
  return (
    <div className="min-h-screen">
      <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className={clsx("transition-[padding] duration-200", collapsed ? "lg:pl-[72px]" : "lg:pl-[264px]")}>
        <div className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-line bg-canvas/90 px-3 backdrop-blur sm:gap-3 sm:px-6 lg:px-8">
          <button onClick={() => setMobileOpen(true)} className="-ml-1 rounded-lg p-2 text-navy hover:bg-white lg:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
          <div className="lg:hidden"><LogoMark size={28} /></div>
          <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
            <div className="mr-1 hidden xl:block"><SyntheticBadge /></div>
            <button onClick={openTour} className={iconBtn} aria-label="Start the tour" title="Start the tour"><CircleHelp className="h-4 w-4" /><span className="hidden md:inline">Tour</span></button>
            <button onClick={openGlossary} className={iconBtn} aria-label="Open glossary" title="Glossary"><BookOpen className="h-4 w-4" /><span className="hidden md:inline">Glossary</span></button>
            <div className="hidden sm:block"><ResetDemoButton /></div>
            <div className="sm:hidden"><ResetDemoButton iconOnly /></div>
            <ModelSelector />
          </div>
        </div>
        <main className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <BackendStatus />
          {children}
        </main>
      </div>
      <TourHost />
      <GlossaryHost />
    </div>
  );
}
