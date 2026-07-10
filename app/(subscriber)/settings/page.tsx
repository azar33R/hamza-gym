import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/subscriber/settings-form";
import { getT } from "@/lib/i18n/server";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  // Pass the user's current phone/email so the form can pre-fill the fields.
  const phone = user.phone ?? null;
  const email = user.email ?? null;

  return (
    <div className="space-y-6">
      <SettingsForm profile={profile} phone={phone} email={email} />
    </div>
  );
}
