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

type Mode = "phone" | "email";

export function SignupForm() {
  const router = useRouter();
  const supabase = createClient();
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
        toast.error("Enter a valid Egyptian number, e.g. 01006857031");
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

    toast.success("Account created! Welcome aboard.");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-4">
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
        <div className="space-y-2">
          <Label htmlFor="full-name">Full Name</Label>
          <Input
            id="full-name"
            type="text"
            required
            autoComplete="name"
            placeholder="Your full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

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
            <p className="text-xs text-zinc-500">
              We&apos;ll use this as your username. No SMS needed.
            </p>
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
            minLength={6}
            autoComplete="new-password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </div>
  );
}
