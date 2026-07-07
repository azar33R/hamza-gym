"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Megaphone, Clock } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendBroadcast, type Audience } from "@/lib/broadcast-actions";
import { useWriteGuard } from "@/lib/admin-write-guard";
import { useOffline } from "@/lib/offline/context";
import { useI18n } from "@/lib/i18n/client";

function parseExpiresIn(value: string, unit: "hours" | "days"): number | null {
  const n = parseInt(value, 10);
  if (isNaN(n) || n <= 0) return null;
  return unit === "hours" ? n * 3600 : n * 86400;
}

export function BroadcastForm({
  users,
}: {
  users: { id: string; full_name: string | null }[];
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [audience, setAudience] = useState<Audience>("active");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [userId, setUserId] = useState<string>("");
  const [expireValue, setExpireValue] = useState("");
  const [expireUnit, setExpireUnit] = useState<"hours" | "days">("days");
  const can = useWriteGuard();
  const { isOnline } = useOffline();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!can("send a broadcast")) return;
    const expiresInSeconds = parseExpiresIn(expireValue, expireUnit);
    startTransition(async () => {
      const res = await sendBroadcast(audience, title, body, userId || undefined, expiresInSeconds);
      if (res.error) {
        toast.error(res.error);
      } else if (res.recipients === 0) {
        toast.info(t("admin.broadcast.no_members"));
      } else {
        toast.success(
          res.delivered > 0
            ? t("admin.broadcast.sent_with_devices", { count: res.recipients, delivered: res.delivered })
            : t("admin.broadcast.sent", { count: res.recipients })
        );
        setTitle("");
        setBody("");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-border bg-card p-5"
    >
      <div className="space-y-2">
        <Label htmlFor="b-audience">{t("admin.broadcast.audience")}</Label>
        <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
          <SelectTrigger id="b-audience">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.broadcast.all")}</SelectItem>
            <SelectItem value="active">{t("admin.broadcast.active")}</SelectItem>
            <SelectItem value="inactive">{t("admin.broadcast.inactive")}</SelectItem>
            <SelectItem value="specific">{t("admin.broadcast.specific")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {audience === "specific" && (
        <div className="space-y-2">
          <Label htmlFor="b-user">{t("admin.broadcast.select_member")}</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger id="b-user">
              <SelectValue placeholder={t("admin.broadcast.choose_member")} />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name ?? t("common.unknown")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="b-title">{t("admin.broadcast.title")}</Label>
        <Input
          id="b-title"
          required
          maxLength={80}
          placeholder={t("admin.broadcast.title_placeholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="b-body">{t("admin.broadcast.message")}</Label>
        <Textarea
          id="b-body"
          maxLength={240}
          placeholder={t("admin.broadcast.message_placeholder")}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <p className="text-end text-xs text-zinc-500">{body.length}/240</p>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Clock className="h-3 w-3" /> {t("admin.broadcast.expires")}
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            placeholder={t("admin.broadcast.expires_placeholder")}
            value={expireValue}
            onChange={(e) => setExpireValue(e.target.value)}
            className="w-24"
          />
          <Select value={expireUnit} onValueChange={(v) => setExpireUnit(v as "hours" | "days")}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hours">{t("admin.broadcast.hours")}</SelectItem>
              <SelectItem value="days">{t("admin.broadcast.days")}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-zinc-500">{t("admin.broadcast.expires_hint")}</p>
        </div>
      </div>

      <Button type="submit" className="w-full gap-2" disabled={pending || !isOnline}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Megaphone className="h-4 w-4" />
        )}
        {t("admin.broadcast.send")}
      </Button>

      <p className="text-xs text-zinc-500">
        {t("admin.broadcast.description")}
      </p>
    </form>
  );
}
