"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/client";
import { ArrowLeft, MessageCircle } from "lucide-react";

export function ChatPlaceholder() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen flex-col bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-50"
        >
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </Link>

        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-16 text-center">
          <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <MessageCircle className="h-8 w-8" />
          </span>
          <h1 className="text-xl font-semibold text-zinc-50">
            {t("chat.chat_with_coach")}
          </h1>
          <p className="mt-2 max-w-xs text-sm text-zinc-400">
            {t("chat.placeholder_desc")}
          </p>
          <span className="mt-6 rounded-full border border-border bg-zinc-950/50 px-3 py-1 text-xs text-zinc-400">
            {t("chat.coming_soon")}
          </span>
        </div>
      </div>
    </div>
  );
}
