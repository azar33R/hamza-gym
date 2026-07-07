"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { normalizeEGPhone } from "@/lib/phone";
import { useI18n } from "@/lib/i18n/client";

type Mode = "phone" | "email";

export function SignupForm() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("phone");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    // The DB trigger handle_new_user() will auto-create the profile row
    // using full_name from auth metadata. No API call needed.
    let result;
    if (mode === "phone") {
      const normalized = normalizeEGPhone(phone);
      if (!normalized) {
        toast.error(t("auth.phone_invalid"));
        setLoading(false);
        return;
      }
      result = await supabase.auth.signUp({
        phone: normalized,
        password,
        options: { data: { full_name: fullName } },
      });
    } else {
      result = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
    }

    const { error } = result;
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success(t("auth.account_created"));
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList className="w-full">
          <TabsTrigger value="phone" className="flex-1">
            🇪🇬 {t("auth.phone")}
          </TabsTrigger>
          <TabsTrigger value="email" className="flex-1">
            {t("auth.email")}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="full-name">{t("auth.full_name")}</Label>
          <Input
            id="full-name"
            type="text"
            required
            autoComplete="name"
            placeholder={t("auth.full_name_placeholder")}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

        {mode === "phone" ? (
          <div className="space-y-2">
            <Label htmlFor="phone">{t("auth.phone")}</Label>
            <div className="flex items-center gap-2">
              <span className="flex h-10 items-center rounded-md border border-input bg-zinc-900 px-3 text-sm font-medium text-zinc-300">
                +20
              </span>
              <Input
                id="phone"
                type="tel"
                required
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder={t("auth.phone_example")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-zinc-500">
              {t("auth.phone_hint")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder={t("auth.email_placeholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder={t("auth.password_min")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? t("auth.creating_account") : t("auth.create_account")}
        </Button>
      </form>
    </div>
  );
}
