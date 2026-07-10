// ============================================================================
//  Food photo to nutrition analysis.
//
//  The actual vision model API is not wired up yet - the user will supply it.
//  To plug it in later, set NUTRITION_API_URL (and optional NUTRITION_API_KEY)
//  in the environment and adjust normalizeExternal() in
//  app/api/nutrition/analyze/route.ts to map the provider's JSON onto
//  NutritionResult. Everything else (UI, storage, types) stays the same.
// ============================================================================

export type NutritionResult = {
  name: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  healthy: boolean;
  confidence: number | null;
  notes: string | null;
};

// Sends the captured food photo to our route handler, which talks to the
// (future) external nutrition API. Returns a normalized result.
export async function analyzeFoodImage(file: File): Promise<NutritionResult> {
  const fd = new FormData();
  fd.append("file", file, file.name);

  const res = await fetch("/api/nutrition/analyze", {
    method: "POST",
    body: fd,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to analyze the photo.");
  }

  return (await res.json()) as NutritionResult;
}
