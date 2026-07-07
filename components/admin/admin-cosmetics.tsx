"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/client";
import { toast } from "sonner";
import { Sparkles, Plus, Type, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { upsertCosmetic, deleteCosmetic } from "@/lib/cosmetics-actions";
import { BANNER_GRADIENTS } from "@/lib/constants";
import type { Cosmetic, CosmeticType, Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

const TIERS: { value: Tier; label: string }[] = [
  { value: "iron", label: "Iron" },
  { value: "bronze", label: "Bronze" },
  { value: "gold", label: "Gold" },
  { value: "diamond", label: "Diamond" },
];

function CosmeticForm({
  cosmetic,
  onClose,
}: {
  cosmetic?: Cosmetic | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [type, setType] = useState<CosmeticType>(cosmetic?.type ?? "nickname");
  const [name, setName] = useState(cosmetic?.name ?? "");
  const [value, setValue] = useState(cosmetic?.value ?? "");
  const [pricePoints, setPricePoints] = useState(String(cosmetic?.price_points ?? ""));
  const [unlockTier, setUnlockTier] = useState<string>(cosmetic?.unlock_tier ?? "none");
  const [sortOrder, setSortOrder] = useState(String(cosmetic?.sort_order ?? 0));
  const [active, setActive] = useState(cosmetic?.is_active ?? true);
  const [pending, startTransition] = useTransition();

  async function handleSave() {
    startTransition(async () => {
      const res = await upsertCosmetic(cosmetic?.id ?? null, {
        type,
        name,
        value,
        price_points: pricePoints ? Number(pricePoints) : null,
        unlock_tier: unlockTier === "none" ? null : (unlockTier as Tier),
        is_active: active,
        sort_order: Number(sortOrder),
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(cosmetic ? t("admin.cosmetics.updated") : t("admin.cosmetics.created"));
        onClose();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="c-type">{t("admin.cosmetics.type")}</Label>
        <Select value={type} onValueChange={(v) => setType(v as CosmeticType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nickname">{t("admin.cosmetics.nickname")}</SelectItem>
            <SelectItem value="banner">{t("admin.cosmetics.banner")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="c-name">{t("admin.cosmetics.display_name")}</Label>
        <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="c-value">
          {type === "nickname" ? t("admin.cosmetics.nickname_text") : t("admin.cosmetics.banner_key")}
        </Label>
        <Input id="c-value" value={value} onChange={(e) => setValue(e.target.value)} />
        {type === "banner" && value && BANNER_GRADIENTS[value] && (
          <div className={cn("mt-2 h-8 rounded bg-gradient-to-r", BANNER_GRADIENTS[value])} />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="c-price">{t("admin.cosmetics.price")}</Label>
          <Input id="c-price" type="number" min={0} value={pricePoints} onChange={(e) => setPricePoints(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="c-tier">{t("admin.cosmetics.unlock_tier")}</Label>
          <Select value={unlockTier} onValueChange={setUnlockTier}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("common.none")}</SelectItem>
              {TIERS.map((tier) => (
                <SelectItem key={tier.value} value={tier.value}>{t(`admin.cosmetics.tier.${tier.value}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="c-sort">{t("admin.cosmetics.sort_order")}</Label>
          <Input id="c-sort" type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </div>
        <div className="flex items-end gap-2 pb-2">
          <input
            type="checkbox"
            id="c-active"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <Label htmlFor="c-active" className="text-sm">{t("common.active")}</Label>
        </div>
      </div>
      <Button onClick={handleSave} disabled={pending} className="w-full">
        {pending ? t("common.saving") : cosmetic ? t("common.update") : t("admin.cosmetics.add_item")}
      </Button>
    </div>
  );
}

export function AdminCosmetics({ cosmetics }: { cosmetics: Cosmetic[] }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<Cosmetic | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [_, startTransition] = useTransition();

  async function handleDelete(id: string) {
    if (!confirm(t("admin.cosmetics.delete_confirm"))) return;
    setPendingId(id);
    startTransition(async () => {
      const res = await deleteCosmetic(id);
      if (res.error) toast.error(res.error);
      else toast.success(t("admin.cosmetics.deleted"));
      setPendingId(null);
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-50">
            <Sparkles className="h-6 w-6 text-primary" /> {t("admin.cosmetics.title")}
          </h1>
          <p className="text-sm text-zinc-400">{t("admin.cosmetics.desc")}</p>
        </div>
      </header>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogTrigger asChild>
          <Button className="gap-1.5">
            <Plus className="h-4 w-4" /> {t("admin.cosmetics.add_item")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.cosmetics.new_item")}</DialogTitle>
            <DialogDescription>{t("admin.cosmetics.new_item_desc")}</DialogDescription>
          </DialogHeader>
          <CosmeticForm onClose={() => setShowNew(false)} />
        </DialogContent>
      </Dialog>

      {cosmetics.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-zinc-500">
          {t("admin.cosmetics.no_items")}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.cosmetics.name")}</TableHead>
                <TableHead>{t("admin.cosmetics.type")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("admin.cosmetics.value")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("admin.cosmetics.price")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("admin.cosmetics.tier")}</TableHead>
                <TableHead>{t("common.active")}</TableHead>
                <TableHead className="text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cosmetics.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-zinc-50">{c.name}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-xs text-zinc-400">
                      {c.type === "nickname" ? <Type className="h-3 w-3" /> : <Shirt className="h-3 w-3" />}
                      {c.type}
                    </span>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-zinc-400 sm:table-cell">
                    {c.type === "banner" && BANNER_GRADIENTS[c.value] ? (
                      <div className={cn("h-4 w-16 rounded bg-gradient-to-r", BANNER_GRADIENTS[c.value])} />
                    ) : (
                      c.value
                    )}
                  </TableCell>
                  <TableCell className="hidden text-zinc-400 sm:table-cell">
                    {c.price_points != null ? `${c.price_points} pts` : "—"}
                  </TableCell>
                  <TableCell className="hidden capitalize text-zinc-400 sm:table-cell">
                    {c.unlock_tier ?? "—"}
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase",
                      c.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-500/15 text-zinc-400"
                    )}>
                      {c.is_active ? t("common.yes") : t("common.no")}
                    </span>
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(c)}
                      >
                        {t("common.edit")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(c.id)}
                        disabled={pendingId === c.id}
                        className="text-red-400"
                      >
                        {t("common.delete")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.cosmetics.edit_item")}</DialogTitle>
            <DialogDescription>{t("admin.cosmetics.edit_item_desc")}</DialogDescription>
          </DialogHeader>
          {editing && <CosmeticForm cosmetic={editing} onClose={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
