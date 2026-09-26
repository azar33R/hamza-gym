"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PhoneCall, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { findContactByPhone } from "@/lib/chat-actions";
import { useI18n } from "@/lib/i18n/client";

// Lets a member start a DM with someone they can't browse to: type their phone
// number, we resolve it to a gym member and open the thread. Staff can use it
// too, but they keep the browsable member list as well.
export function PhoneLookup({ basePath }: { basePath: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await findContactByPhone(phone);
      if (res.error === "invalid_phone") {
        setError(t("chat.lookup.invalid_phone"));
        return;
      }
      if (res.error === "not_found") {
        setError(t("chat.lookup.not_found"));
        return;
      }
      if (res.error === "self") {
        setError(t("chat.lookup.self"));
        return;
      }
      if (res.error) {
        setError(t("chat.load_error"));
        return;
      }
      if (res.contact) {
        // The grant proves this conversation was started deliberately by phone
        // lookup; without it the thread page refuses brand-new member threads.
        router.push(`${basePath}/${res.contact.id}?t=${res.grant ?? ""}`);
      }
    });
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-card p-4">
      <Label htmlFor="chat-lookup-phone" className="flex items-center gap-1.5 text-[13px] text-zinc-300">
        <PhoneCall className="h-3.5 w-3.5 text-primary" />
        {t("chat.lookup.title")}
      </Label>

      <div className="mt-2.5 flex items-center gap-2">
        <span className="flex h-10 items-center rounded-md border border-input bg-zinc-900 px-3 text-sm font-medium text-zinc-300">
          +20
        </span>
        <Input
          id="chat-lookup-phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder={t("chat.lookup.placeholder")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="flex-1"
        />
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      <Button type="submit" className="mt-3 w-full gap-2" disabled={pending}>
        <Search className="h-4 w-4" />
        {pending ? t("chat.lookup.searching") : t("chat.lookup.button")}
      </Button>

      <p className="mt-2 text-[11px] leading-snug text-zinc-500">
        {t("chat.lookup.hint")}
      </p>
    </form>
  );
}
