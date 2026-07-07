// Egyptian phone-number normalization for Supabase auth.
//
// Egyptian mobile numbers are 11 digits with a leading 0, e.g. 01006857031.
// Supabase requires E.164 (+20…) for the Phone provider, so we normalize:
//   • "01006857031"  → strip leading 0 → "1006857031" → "+201006857031"
//   • "1006857031"   → no leading 0   → "+201006857031"
//   • "+201006857031" / "201006857031" → already correct → "+201006857031"
// Anything that doesn't end up as +20 followed by exactly 10 digits is invalid.

// Returns the E.164 string (+20…) when valid, or null when the input isn't a
// recognizable Egyptian mobile number.
export function normalizeEGPhone(input: string): string | null {
  // Keep only digits and a leading +.
  let s = input.trim();
  const hasPlus = s.startsWith("+");
  s = s.replace(/[^\d]/g, "");

  // Case 1: full E.164 with country code — "+201006857031" → digits "201006857031"
  if (hasPlus || s.startsWith("20")) {
    // If the user typed "+20 0100…", we may have the leading 0 too: "2001006857031".
    if (s.startsWith("20")) {
      s = s.slice(2); // drop country code → "1006857031" (or "01006857031")
    }
  }

  // Case 2: local 11-digit with leading 0 — "01006857031" → "1006857031"
  // Case 3: 10-digit already stripped — "1006857031" stays as is.
  if (s.startsWith("0")) s = s.slice(1);

  // After normalization we must have exactly 10 digits (Egyptian mobile minus
  // the trunk 0 / country code).
  if (!/^\d{10}$/.test(s)) return null;

  return "+20" + s;
}
