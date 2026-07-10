import { NextRequest, NextResponse } from "next/server";
import type { NutritionResult } from "@/lib/nutrition";

export const runtime = "nodejs";

// ----------------------------------------------------------------------------
//  Nutrition analysis endpoint.
//
//  When NUTRITION_API_URL is set, the uploaded image is forwarded to that
//  external vision API and its response is mapped onto NutritionResult via
//  normalizeExternal(). Until the API is provided, a mock result is returned
//  so the UI can be built and tested end-to-end.
//
//  Expected external response (adjust normalizeExternal to match your API):
//    {
//      "name": string,
//      "calories": number,
//      "protein_g": number,
//      "carbs_g": number,
//      "fat_g": number,
//      "healthy": boolean,
//      "confidence": number | null,
//      "notes": string | null
//    }
// ----------------------------------------------------------------------------

function mockResult(): NutritionResult {
  return {
    name: null,
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    healthy: false,
    confidence: null,
    notes: "DEMO: set NUTRITION_API_URL to get real results.",
  };
}

// TODO: map the real provider response onto NutritionResult once the API
// (and its exact field names) are known.
function normalizeExternal(_data: unknown): NutritionResult {
  // Example:
  // const d = _data as any;
  // return {
  //   name: d.name ?? null,
  //   calories: Number(d.calories) || 0,
  //   protein_g: Number(d.protein_g) || 0,
  //   carbs_g: Number(d.carbs_g) || 0,
  //   fat_g: Number(d.fat_g) || 0,
  //   healthy: Boolean(d.healthy),
  //   confidence: d.confidence ?? null,
  //   notes: d.notes ?? null,
  // };
  return mockResult();
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file'." }, { status: 400 });
  }

  const apiUrl = process.env.NUTRITION_API_URL;
  if (apiUrl) {
    try {
      const fd = new FormData();
      fd.append("file", file, file.name);
      const headers: Record<string, string> = {};
      if (process.env.NUTRITION_API_KEY) {
        headers["Authorization"] = `Bearer ${process.env.NUTRITION_API_KEY}`;
      }
      const upstream = await fetch(apiUrl, {
        method: "POST",
        body: fd,
        headers,
      });
      if (!upstream.ok) {
        return NextResponse.json(
          { error: "Nutrition provider error." },
          { status: 502 }
        );
      }
      const data = await upstream.json();
      return NextResponse.json(normalizeExternal(data));
    } catch {
      return NextResponse.json(
        { error: "Failed to reach nutrition provider." },
        { status: 502 }
      );
    }
  }

  return NextResponse.json(mockResult());
}
