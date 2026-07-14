import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Whole calendar days remaining until `endDate` (a YYYY-MM-DD string),
// measured in the viewer's LOCAL timezone. Using local midnight for both ends
// avoids the off-by-one that `new Date("YYYY-MM-DD")` causes (it parses as UTC
// midnight, which is already "past" for positive-UTC zones like Egypt).
export function daysLeftUntil(endDate: string | null | undefined): number | null {
  if (!endDate) return null;
  const end = new Date(`${endDate}T00:00:00`);
  if (isNaN(end.getTime())) return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = end.getTime() - startOfToday.getTime();
  return Math.max(0, Math.round(diff / 86_400_000));
}
