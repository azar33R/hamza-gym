import { createClient } from "@/lib/supabase/server";
import { isOnboarded } from "@/lib/onboarding";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/subscriber/onboarding-form";

export const dynamic = "force-dynamic";

// The /onboarding route. If already onboarded, bounce to the dashboard.
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, face_photo_url, age, height_cm, weight_kg, subscription_status")
    .eq("id", user!.id)
    .single();

  if (profile && isOnboarded(profile) && profile.subscription_status === "active") {
    redirect("/dashboard");
  }

  return <OnboardingForm fullName={profile?.full_name ?? null} />;
}
