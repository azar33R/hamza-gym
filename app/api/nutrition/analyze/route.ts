import { NextRequest, NextResponse } from "next/server";
import type { NutritionResult } from "@/lib/nutrition";

export const runtime = "nodejs";

// ----------------------------------------------------------------------------
//  Food photo -> nutrition analysis via Google Gemini (vision + JSON mode).
//
//  Uses gemini-3.1-flash-lite by default (override with GEMINI_MODEL). Both
//  provided API keys are tried in order (GEMINI_API_KEY, then GEMINI_API_KEY_2)
//  so a quota/limit on one falls back to the other. The image is sent inline
//  and Gemini is forced to reply with JSON matching NutritionResult.
// ----------------------------------------------------------------------------

const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING" },
    calories: { type: "NUMBER" },
    protein_g: { type: "NUMBER" },
    carbs_g: { type: "NUMBER" },
    fat_g: { type: "NUMBER" },
    healthy: { type: "BOOLEAN" },
    confidence: { type: "NUMBER" },
    notes: { type: "STRING" },
  },
  required: ["calories", "protein_g", "carbs_g", "fat_g", "healthy"],
} as const;

function getKeys(): string[] {
  return [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2].filter(
    (k): k is string => Boolean(k)
  );
}

function normalize(data: unknown): NutritionResult {
  const d = (data ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    name: typeof d.name === "string" && d.name ? d.name : null,
    calories: num(d.calories),
    protein_g: num(d.protein_g),
    carbs_g: num(d.carbs_g),
    fat_g: num(d.fat_g),
    healthy: Boolean(d.healthy),
    confidence: d.confidence != null ? num(d.confidence) : null,
    notes: typeof d.notes === "string" && d.notes ? d.notes : null,
  };
}

async function analyzeWithGemini(
  key: string,
  base64: string,
  mime: string
): Promise<NutritionResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mime, data: base64 } },
            {
              text:
                "You are a nutrition analyzer. Look at this food image and estimate its nutrition. Respond ONLY with the requested JSON.",
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${txt.slice(0, 200)}`);
  }

  const json = await res.json();
  const text: string | undefined =
    json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini.");

  try {
    return normalize(JSON.parse(text));
  } catch {
    throw new Error("Gemini returned invalid JSON.");
  }
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file'." }, { status: 400 });
  }

  const mime = file.type || "image/jpeg";
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  const keys = getKeys();
  if (keys.length === 0) {
    return NextResponse.json(
      { error: "Gemini API key not configured (set GEMINI_API_KEY)." },
      { status: 500 }
    );
  }

  let lastErr: unknown;
  for (const key of keys) {
    try {
      const result = await analyzeWithGemini(key, base64, mime);
      return NextResponse.json(result);
    } catch (e) {
      lastErr = e;
    }
  }

  return NextResponse.json(
    { error: lastErr instanceof Error ? lastErr.message : "Gemini analysis failed." },
    { status: 502 }
  );
}
