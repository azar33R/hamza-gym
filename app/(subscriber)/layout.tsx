import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { isOnboarded } from "@/lib/onboarding";
import { SubscriptionGate } from "@/components/subscriber/subscription-gate";
import { BottomNav } from "@/components/subscriber/bottom-nav";
import { TabShellProvider } from "@/app/(subscriber)/tab-context";

// Opt out of static caching — always fetch fresh profile data.
export const dynamic = "force-dynamic";

export default async function SubscriberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  // Admins and staff get routed to their own area.
  if (profile?.role === "admin" || profile?.role === "staff") {
    redirect("/admin");
  }

  // Resolve name: profile.full_name first, fall back to auth metadata.
  const fullName =
    profile?.full_name ||
    user.user_metadata?.full_name ||
    null;

  return (
    <SubscriptionGate
      status={profile?.subscription_status ?? "inactive"}
      fullName={fullName}
      onboarded={isOnboarded(profile)}
    >
      <TabShellProvider>
        <main className="mx-auto w-full max-w-3xl overflow-x-hidden px-4 py-6 pb-28">
          {children}
        </main>
        <BottomNav />
      </TabShellProvider>
    </SubscriptionGate>
  );
}
