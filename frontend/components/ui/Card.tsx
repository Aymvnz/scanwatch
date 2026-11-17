import clsx from "clsx";
import type { ReactNode } from "react";

export function Card({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <div className={clsx("card", padded && "p-5", className)}>{children}</div>;
}

export function CardHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-navy">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] leading-5 text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
