"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, Gem, CheckCircle2, Shirt, Type, Lock, Unlock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buyCosmetic, equipCosmetic, unequipCosmetic } from "@/lib/cosmetics-actions";
import { BANNER_GRADIENTS } from "@/lib/constants";
import type { CosmeticsShop as CosmeticsShopType } from "@/lib/cosmetics-actions";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";

function BannerPreview({ value }: { value: string }) {
  const gradient = BANNER_GRADIENTS[value];
  if (!gradient) return null;
  return (
    <div
      className={cn("h-12 w-full rounded-lg bg-gradient-to-r", gradient)}
    />
  );
}

function isLocked(item: CosmeticsShopType["nicknames"][number]) {
  return !item.owned && !item.freeForTier && item.unlock_tier != null && item.price_points == null;
}

export function CosmeticsShop({
  userId,
  shop,
}: {
  userId: string;
  shop: CosmeticsShopType | null;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"nicknames" | "banners">("nicknames");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [_, startTransition] = useTransition();

  async function handleAction(item: CosmeticsShopType["nicknames"][number]) {
    setPendingId(item.id);
    startTransition(async () => {
      let res: { error: string | null };
      if (!item.owned) {
        res = await buyCosmetic(item.id);
      } else if (item.equipped) {
        res = await unequipCosmetic(item.id);
      } else {
        res = await equipCosmetic(item.id);
      }
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(
          item.owned && !item.equipped
            ? t("cosmetics.equipped_toast")
            : item.equipped
            ? t("cosmetics.unequipped_toast")
            : t("cosmetics.bought")
        );
      }
      setPendingId(null);
    });
  }

  if (!shop) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-zinc-500">
        {t("cosmetics.load_error")}
      </div>
    );
  }

  const nicknames = shop.nicknames;
  const banners = shop.banners;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-50">
          <Sparkles className="h-6 w-6 text-primary" /> {t("cosmetics.title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {t("cosmetics.desc")}
        </p>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "nicknames" | "banners")}>
        <TabsList className="w-full">
          <TabsTrigger value="nicknames" className="gap-1.5 flex-1">
            <Type className="h-3.5 w-3.5" /> {t("cosmetics.nicknames")}
          </TabsTrigger>
          <TabsTrigger value="banners" className="gap-1.5 flex-1">
            <Shirt className="h-3.5 w-3.5" /> {t("cosmetics.banners")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nicknames" className="mt-4 space-y-3">
          {nicknames.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-zinc-500">
              {t("cosmetics.no_nicknames")}
            </div>
          ) : (
            nicknames.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-4 rounded-2xl border p-4",
                  item.equipped
                    ? "border-primary/50 bg-primary/10"
                    : "border-white/5 bg-zinc-900/60"
                )}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-lg font-black text-zinc-50">
                  {item.value.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-zinc-50">
                    &ldquo;{item.value}&rdquo;
                  </p>
                  <p className="text-xs text-zinc-500">{item.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    {item.owned && (
                      <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> {t("cosmetics.owned")}
                      </span>
                    )}
                    {item.equipped && (
                      <span className="flex items-center gap-0.5 text-[10px] text-primary">
                        <Star className="h-3 w-3" /> {t("cosmetics.equipped")}
                      </span>
                    )}
                    {item.freeForTier && !item.owned && (
                      <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                        <Unlock className="h-3 w-3" /> {t("cosmetics.free")}
                      </span>
                    )}
                    {item.unlock_tier != null && !item.freeForTier && !item.owned && (
                      <span className="flex items-center gap-0.5 text-[10px] text-zinc-500">
                        <Lock className="h-3 w-3" />{" "}
                        {t("cosmetics.reach_tier", { tier: t(`tier.${item.unlock_tier}`) || item.unlock_tier })}
                      </span>
                    )}
                    {item.price_points != null && !item.freeForTier && !item.owned && (
                      <span className="flex items-center gap-0.5 text-[10px] text-zinc-400">
                        <Gem className="h-3 w-3" /> {t("cosmetics.price", { price: item.price_points })}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={item.equipped ? "secondary" : item.owned ? "outline" : "default"}
                  onClick={() => handleAction(item)}
                  disabled={pendingId === item.id || isLocked(item)}
                >
                  {pendingId === item.id
                    ? "\u2026"
                    : item.equipped
                    ? t("cosmetics.unequip")
                    : item.owned
                    ? t("cosmetics.equip")
                    : item.freeForTier
                    ? t("cosmetics.claim")
                    : isLocked(item)
                    ? t("cosmetics.locked")
                    : t("cosmetics.buy")}
                </Button>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="banners" className="mt-4 space-y-3">
          {banners.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-zinc-500">
              {t("cosmetics.no_banners")}
            </div>
          ) : (
            banners.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "overflow-hidden rounded-2xl border",
                  item.equipped
                    ? "border-primary/50"
                    : "border-white/5"
                )}
              >
                <div className="p-4 pb-0">
                  <BannerPreview value={item.value} />
                </div>
                <div className="flex items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-zinc-50">{item.name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      {item.owned && (
                        <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> {t("cosmetics.owned")}
                        </span>
                      )}
                      {item.equipped && (
                        <span className="flex items-center gap-0.5 text-[10px] text-primary">
                          <Star className="h-3 w-3" /> {t("cosmetics.equipped")}
                        </span>
                      )}
                      {item.freeForTier && !item.owned && (
                        <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                          <Unlock className="h-3 w-3" /> {t("cosmetics.free")}
                        </span>
                      )}
                      {item.unlock_tier != null && !item.freeForTier && !item.owned && (
                        <span className="flex items-center gap-0.5 text-[10px] text-zinc-500">
                          <Lock className="h-3 w-3" />{" "}
                          {t("cosmetics.reach_tier", { tier: t(`tier.${item.unlock_tier}`) || item.unlock_tier })}
                        </span>
                      )}
                      {item.price_points != null && !item.freeForTier && !item.owned && (
                        <span className="flex items-center gap-0.5 text-[10px] text-zinc-400">
                          <Gem className="h-3 w-3" /> {t("cosmetics.price", { price: item.price_points })}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={item.equipped ? "secondary" : item.owned ? "outline" : "default"}
                    onClick={() => handleAction(item)}
                    disabled={pendingId === item.id || isLocked(item)}
                  >
                    {pendingId === item.id
                      ? "\u2026"
                      : item.equipped
                      ? t("cosmetics.unequip")
                      : item.owned
                      ? t("cosmetics.equip")
                      : item.freeForTier
                      ? t("cosmetics.claim")
                      : isLocked(item)
                      ? t("cosmetics.locked")
                      : t("cosmetics.buy")}
                  </Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
