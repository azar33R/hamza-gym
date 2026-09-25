"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export function SubscriptionArc({
  daysLeft,
  fraction,
  daysLabel,
  subLabel,
  className,
}: {
  daysLeft: number | null;
  /** 0..1 — share of the subscription remaining (green arc length) */
  fraction: number;
  daysLabel: string;
  subLabel: string;
  className?: string;
}) {
  const gid = useId();
  const pct = Math.min(1, Math.max(0, fraction));

  // Semi-circle geometry: viewBox 200x110, radius 80 centered at (100,100).
  // Arc length = PI * r ≈ 251.3. We dash the green portion over a grey track.
  const R = 80;
  const LEN = Math.PI * R;
  const greenLen = LEN * pct;

  const display =
    daysLeft === null
      ? "—"
      : typeof document !== "undefined" &&
          document.documentElement.lang === "ar"
        ? daysLeft.toLocaleString("ar-EG-u-nu-arab")
        : String(daysLeft);

  return (
    <div className={cn("relative mx-auto w-full max-w-[340px]", className)}>
      <svg viewBox="0 0 200 112" className="w-full overflow-visible">
        <defs>
          <filter id={`${gid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id={`${gid}-green`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#a3e635" />
            <stop offset="100%" stopColor="#84cc16" />
          </linearGradient>
        </defs>

        {/* track */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#52525b"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* progress */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={`url(#${gid}-green)`}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${greenLen} ${LEN}`}
          filter={`url(#${gid}-glow)`}
          style={{ transition: "stroke-dasharray 1s ease-out" }}
        />
      </svg>

      {/* centered number */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-2 flex flex-col items-center justify-end text-center">
        <span className="text-8xl font-black leading-none text-lime-400 drop-shadow-[0_0_18px_rgba(132,204,22,0.45)]">
          {display}
        </span>
        <span className="mt-1 text-2xl font-extrabold text-lime-400">{daysLabel}</span>
        {subLabel ? (
          <span className="mt-0.5 text-[11px] font-medium text-zinc-500">{subLabel}</span>
        ) : null}
      </div>
    </div>
  );
}
