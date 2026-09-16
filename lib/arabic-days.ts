// Arabic day-count pluralization (يوم).
//
// Standard Arabic rules for the masculine noun يوم:
//   1      -> "يوم واحد"   (no digit)
//   2      -> "يومين"      (dual, no digit)
//   3-10   -> "{n} أيام"   (plural)
//   11+    -> "{n} يوم"    (singular, accusative)
// So 2 يوم is wrong (must be يومين), 7 يوم is wrong (must be 7 أيام),
// and 15 أيام is wrong (must be 15 يوم).

function absInt(n: number): number {
  return Math.abs(Math.trunc(n));
}

export function isArabicLocale(locale: string | null | undefined): boolean {
  return (locale ?? "ar").toLowerCase().startsWith("ar");
}

/** "باقي يوم واحد" / "باقي يومين" / "باقي 7 أيام" / "باقي 15 يوم" */
export function arabicDaysLeft(n: number): string {
  const a = absInt(n);
  if (a === 1) return "باقي يوم واحد";
  if (a === 2) return "باقي يومين";
  if (a >= 3 && a <= 10) return `باقي ${a} أيام`;
  return `باقي ${a} يوم`;
}

/** "انتهى من يوم واحد" / "انتهى من يومين" / "انتهى من 7 أيام" / "انتهى من 15 يوم" */
export function arabicExpiredAgo(n: number): string {
  const a = absInt(n);
  if (a === 1) return "انتهى من يوم واحد";
  if (a === 2) return "انتهى من يومين";
  if (a >= 3 && a <= 10) return `انتهى من ${a} أيام`;
  return `انتهى من ${a} يوم`;
}

/** "يوم واحد متبقي" / "يومين متبقي" / "7 أيام متبقية" / "15 يوم متبقي" */
export function arabicRemaining(n: number): string {
  const a = absInt(n);
  if (a === 1) return "يوم واحد متبقي";
  if (a === 2) return "يومين متبقي";
  if (a >= 3 && a <= 10) return `${a} أيام متبقية`;
  return `${a} يوم متبقي`;
}

/** "من يوم واحد" / "من يومين" / "من 5 أيام" / "من 15 يوم" (chat / relative time) */
export function arabicAgo(n: number): string {
  const a = absInt(n);
  if (a === 1) return "من يوم واحد";
  if (a === 2) return "من يومين";
  if (a >= 3 && a <= 10) return `من ${a} أيام`;
  return `من ${a} يوم`;
}

/** "تبقّى يوم واحد" / "تبقّى يومين" / "تبقّى 3 أيام" (push notifications) */
export function arabicRemainVerb(n: number): string {
  const a = absInt(n);
  if (a === 1) return "تبقّى يوم واحد";
  if (a === 2) return "تبقّى يومين";
  if (a >= 3 && a <= 10) return `تبقّى ${a} أيام`;
  return `تبقّى ${a} يوم`;
}

/** "(باقي يومين)" / "(باقي 7 أيام)" — parenthetical for WhatsApp reminders */
export function arabicParentheticalLeft(n: number): string {
  const a = absInt(n);
  if (a === 1) return "(باقي يوم واحد)";
  if (a === 2) return "(باقي يومين)";
  if (a >= 3 && a <= 10) return `(باقي ${a} أيام)`;
  return `(باقي ${a} يوم)`;
}

/** "(من يومين)" / "(من 7 أيام)" — parenthetical for WhatsApp reminders */
export function arabicParentheticalAgo(n: number): string {
  const a = absInt(n);
  if (a === 1) return "(من يوم واحد)";
  if (a === 2) return "(من يومين)";
  if (a >= 3 && a <= 10) return `(من ${a} أيام)`;
  return `(من ${a} يوم)`;
}
