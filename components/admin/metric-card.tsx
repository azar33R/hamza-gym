"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  icon,
  trend,
  className,
  revealable,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: "up" | "down" | "neutral";
  className?: string;
  revealable?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/30",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          {label}
        </p>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
          {icon}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <p className="text-2xl font-bold tracking-tight text-zinc-50">
          {revealable && !revealed ? "•••••••" : value}
        </p>
        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            className="text-zinc-500 hover:text-zinc-300"
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
