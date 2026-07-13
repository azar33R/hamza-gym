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
import { redeemAccessCode } from "@/lib/member-actions";
import { useI18n } from "@/lib/i18n/client";

type Mode = "phone" | "email";

export function LoginForm() {
  const router = useRouter();
  const { t } = useI18n();
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>("phone");
  const [useCode, setUseCode] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    let result;
    if (mode === "phone") {
      const normalized = normalizeEGPhone(phone);
      if (!normalized) {
        toast.error("Enter a valid Egyptian number, e.g. 01006857031");
        setLoading(false);
        return;
      }
      result = await supabase.auth.signInWithPassword({
        phone: normalized,
        password,
      });
    } else {
      result = await supabase.auth.signInWithPassword({
        email,
        password,
      });
    }

    const { error } = result;
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Check role to route admin → /admin, subscriber → /dashboard
    const {
      data: { user: loggedInUser },
    } = await supabase.auth.getUser();

    if (loggedInUser) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", loggedInUser.id)
        .single();

      router.push(profile?.role === "admin" ? "/admin" : "/dashboard");
    } else {
      router.push("/dashboard");
    }

    router.refresh();
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);

    const res = await redeemAccessCode(code);
    if (res.error) {
      if (res.error === "expired") toast.error(t("auth.code_expired"));
      else toast.error(t("auth.code_invalid"));
      setLoading(false);
      return;
    }

    // Sign in with the one-time credentials returned by the server action.
    const creds =
      res.identifierType === "phone"
        ? { phone: res.identifier!, password: res.tempPassword! }
        : { email: res.identifier!, password: res.tempPassword! };
    const { error } = await supabase.auth.signInWithPassword(creds);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {useCode ? (
        <form onSubmit={handleCodeSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="access-code">{t("auth.access_code")}</Label>
            <Input
              id="access-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t("auth.code_placeholder")}
              className="font-mono tracking-wider"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? "Opening…" : t("auth.code_signin")}
          </Button>
          <button
            type="button"
            onClick={() => setUseCode(false)}
            className="w-full text-center text-sm text-zinc-500 hover:text-zinc-300"
          >
            {t("auth.use_password")}
          </button>
        </form>
      ) : (
        <>
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="w-full">
              <TabsTrigger value="phone" className="flex-1">
                🇪🇬 Phone
              </TabsTrigger>
              <TabsTrigger value="email" className="flex-1">
                Email
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "phone" ? (
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
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
                    placeholder="01006857031"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setUseCode(true)}
            className="w-full text-center text-sm text-zinc-500 hover:text-zinc-300"
          >
            {t("auth.use_code")}
          </button>
        </>
      )}
    </div>
  );
}
