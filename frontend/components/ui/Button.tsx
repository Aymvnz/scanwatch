import clsx from "clsx";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger"; loading?: boolean; icon?: ReactNode; size?: "sm" | "md";
}

export function Button({ variant = "secondary", loading, icon, size = "md", className, children, disabled, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-9 px-3.5 text-sm",
        variant === "primary" && "bg-primary text-white hover:bg-primary-dark",
        variant === "secondary" && "border border-line bg-white text-navy shadow-card hover:border-slate-300",
        variant === "ghost" && "text-muted hover:bg-white hover:text-navy",
        variant === "danger" && "bg-crit text-white hover:opacity-90",
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}
