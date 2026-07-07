"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/client";

export function AdminSignOutButton() {
  const { t } = useI18n();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success(t("auth.signed_out"));
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-50 active:scale-95"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">{t("auth.sign_out")}</span>
    </button>
  );
}
