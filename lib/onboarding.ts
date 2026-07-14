import type { Profile } from "@/lib/types";

// An active subscriber is "onboarded" once they have a face photo + the four
// physical detail fields, OR have explicitly skipped onboarding. Used by the
// subscriber layout to force onboarding.
export function isOnboarded(p: Pick<
  Profile,
  "onboarded" | "face_photo_url" | "age" | "height_cm" | "weight_kg"
> | null | undefined): boolean {
  if (!p) return false;
  if (p.onboarded) return true;
  return Boolean(
    p.face_photo_url &&
      p.age != null && p.age > 0 &&
      p.height_cm != null && p.height_cm > 0 &&
      p.weight_kg != null && p.weight_kg > 0
  );
}
