import { LayoutDashboard, Boxes, Activity, FlaskConical, ShieldCheck, Bell, FileText, Settings, type LucideIcon } from "lucide-react";

export interface NavItem { label: string; href: string; icon: LucideIcon; }

export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Models", href: "/models", icon: Boxes },
  { label: "Performance", href: "/performance", icon: Activity },
  { label: "Drift Detection Lab", href: "/drift-lab", icon: FlaskConical },
  { label: "Patient Safety", href: "/patient-safety", icon: ShieldCheck },
  { label: "Alerts", href: "/alerts", icon: Bell },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "Settings", href: "/settings", icon: Settings },
];
