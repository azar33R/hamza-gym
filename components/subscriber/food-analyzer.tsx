"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  ImagePlus,
  Loader2,
  Apple,
  Flame,
  Beef,
  Wheat,
  Droplet,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { analyzeFoodImage, type NutritionResult } from "@/lib/nutrition";

function MacroBar({
  label,
  value,
  max,
  icon,
  unit = "g",
}: {
  label: string;
  value: number;
  max: number;
  icon: React.ReactNode;
  unit?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-zinc-400">
          {icon}
          {label}
        </span>
        <span className="font-semibold text-zinc-100">
          {value}
          {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function FoodAnalyzer() {
  const { t, locale } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NutritionResult | null>(null);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setFile(f);
    setResult(null);
    setPreview(URL.createObjectURL(f));
  }

  async function analyze() {
    if (!file) return;
    setLoading(true);
    try {
      const res = await analyzeFoodImage(file, locale);
      setResult(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  const maxMacro = result
    ? Math.max(result.protein_g, result.carbs_g, result.fat_g, 1)
    : 1;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-50">
          <Apple className="h-6 w-6 text-primary" /> {t("nutrition.title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">{t("nutrition.subtitle")}</p>
      </header>

      {/* Capture / upload */}
      <div className="rounded-2xl border border-border bg-card p-5">
        {preview ? (
          <div className="relative overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Food"
              className="mx-auto max-h-72 w-full rounded-xl object-cover"
            />
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/70">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border text-zinc-400">
            <Camera className="h-8 w-8" />
            <span className="text-sm">{t("nutrition.tap_to_capture")}</span>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5" disabled={loading}>
            <label className="cursor-pointer">
              <Camera className="h-4 w-4" /> {t("photo.take")}
              <input
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={pickFile}
                disabled={loading}
              />
            </label>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5" disabled={loading}>
            <label className="cursor-pointer">
              <ImagePlus className="h-4 w-4" /> {t("photo.gallery")}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={pickFile}
                disabled={loading}
              />
            </label>
          </Button>
        </div>

        <Button
          className="mt-4 w-full gap-2"
          size="lg"
          onClick={analyze}
          disabled={!file || loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {t("nutrition.analyzing")}
            </>
          ) : (
            <>
              <Apple className="h-4 w-4" /> {t("nutrition.analyze")}
            </>
          )}
        </Button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-zinc-50">
              {result.name ?? t("nutrition.unnamed")}
            </h2>
            <span
              className={
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold " +
                (result.healthy
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-red-500/15 text-red-400")
              }
            >
              {result.healthy ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              {result.healthy ? t("nutrition.healthy") : t("nutrition.unhealthy")}
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-zinc-900 p-3">
            <Flame className="h-5 w-5 text-primary" />
            <span className="text-sm text-zinc-400">{t("nutrition.calories")}</span>
            <span className="ms-auto text-lg font-bold text-zinc-50">
              {result.calories} kcal
            </span>
          </div>

          <div className="space-y-3">
            <MacroBar
              label={t("nutrition.protein")}
              value={result.protein_g}
              max={maxMacro}
              icon={<Beef className="h-3.5 w-3.5" />}
            />
            <MacroBar
              label={t("nutrition.carbs")}
              value={result.carbs_g}
              max={maxMacro}
              icon={<Wheat className="h-3.5 w-3.5" />}
            />
            <MacroBar
              label={t("nutrition.fat")}
              value={result.fat_g}
              max={maxMacro}
              icon={<Droplet className="h-3.5 w-3.5" />}
            />
          </div>

          {result.notes && (
            <p className="text-xs text-zinc-500">{result.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}
