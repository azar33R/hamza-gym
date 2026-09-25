"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  icon,
  hint,
  className,
  maskable,
  href,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  /** Optional secondary line under the value (e.g. a count or a delta). */
  hint?: string;
  /** Shows an eye toggle that hides the value. Starts HIDDEN. */
  maskable?: boolean;
  className?: string;
  href?: string;
}) {
  const [hidden, setHidden] = useState(true);
  // Only maskable cards can be hidden; the rest always show their value.
  const masked = !!maskable && hidden;

  const content = (
    <>
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-zinc-500">{icon}</span>
        <p className="truncate text-[13px] font-medium text-zinc-400">{label}</p>
        {maskable && (
          <button
            type="button"
            aria-label={masked ? `show ${label}` : `hide ${label}`}
            title={masked ? `show ${label}` : `hide ${label}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setHidden((h) => !h);
            }}
            className={cn(
              "ms-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors",
              hidden
                ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                : "border-zinc-700 bg-white/5 text-zinc-300 hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
            )}
          >
            {masked ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      <p
        className={cn(
          "mt-2 text-2xl font-bold leading-none tracking-tight tabular-nums",
          masked ? "select-none text-zinc-600" : "text-zinc-50"
        )}
      >
        {masked ? "••••••" : value}
      </p>
      {hint && !masked && <p className="mt-1.5 text-[11px] text-zinc-500">{hint}</p>}
    </>
  );

  const cls = cn(
    "rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30",
    className
  );

  if (href) {
    return (
      <Link href={href} className={cn(cls, "block cursor-pointer")}>
        {content}
      </Link>
    );
  }

  return <div className={cls}>{content}</div>;
}
