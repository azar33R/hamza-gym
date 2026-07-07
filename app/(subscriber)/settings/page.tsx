import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/subscriber/settings-form";
import { LanguageToggle } from "@/components/language-toggle";
import { getT } from "@/lib/i18n/server";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const t = await getT();
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

      {/* Language preference — cookie-backed, works for the whole app. */}
      <section className="flex items-center justify-between rounded-2xl border border-border bg-card p-5">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">{t("lang.toggle")}</h2>
        </div>
        <LanguageToggle />
      </section>
    </div>
  );
}
