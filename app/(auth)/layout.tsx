import { Dumbbell } from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";
import { getT } from "@/lib/i18n/server";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getT();
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      {/* Language toggle — top corner. Works before any profile exists. */}
      <div className="absolute top-4 inset-x-4 flex justify-end">
        <LanguageToggle compact />
      </div>
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-lime-500/20">
          <Dumbbell className="h-7 w-7" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
            {t("auth.welcome_title")}
          </h1>
          <p className="text-sm text-zinc-400">{t("auth.welcome_sub")}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
