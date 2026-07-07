"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ShoppingBag, CreditCard, Clock, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { useI18n } from "@/lib/i18n/client";
import { createOrder } from "@/lib/shop-actions";
import type { ShopProduct, ShopOrder, ShopOrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<ShopOrderStatus, string> = {
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  rejected: "bg-red-500/15 text-red-400 border-red-500/30",
  fulfilled: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

const STATUS_LABEL_KEYS: Record<ShopOrderStatus, string> = {
  pending: "shop.pending",
  approved: "shop.approved",
  rejected: "shop.rejected",
  fulfilled: "shop.ready",
};

function OrderStatusBadge({ status }: { status: ShopOrderStatus }) {
  const { t } = useI18n();
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", STATUS_STYLES[status])}>
      {t(STATUS_LABEL_KEYS[status])}
    </span>
  );
}

function OrderDialog({ orders }: { orders: (ShopOrder & { product_name: string | null })[] }) {
  const { t } = useI18n();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {t("shop.my_orders")}{orders.length > 0 && ` (${orders.length})`}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {t("shop.order_history")}
          </DialogTitle>
          <DialogDescription>{t("shop.orders_desc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {orders.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">{t("shop.no_orders")}</p>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-50">{o.product_name ?? t("shop.product")}</p>
                    <p className="text-xs text-zinc-500">{o.price_egp_snapshot} EGP</p>
                    <p className="mt-1 text-[10px] text-zinc-600">
                      {new Date(o.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <OrderStatusBadge status={o.status} />
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ProShop({
  products,
  orders,
}: {
  userId: string;
  products: ShopProduct[];
  orders: (ShopOrder & { product_name: string | null })[];
}) {
  const { t } = useI18n();
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactNotes, setContactNotes] = useState("");
  const [pending, startTransition] = useTransition();

  async function handleBuy(productId: string) {
    if (!contactName.trim() || !contactPhone.trim()) {
      toast.error(t("shop.enter_contact_info"));
      return;
    }
    setBuyingId(productId);
    startTransition(async () => {
      const res = await createOrder({
        productId,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        contactNotes: contactNotes.trim(),
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("shop.order_placed"));
        setContactName("");
        setContactPhone("");
        setContactNotes("");
      }
      setBuyingId(null);
    });
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-50">
            <ShoppingBag className="h-6 w-6 text-primary" /> {t("shop.pro_shop")}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">{t("shop.pro_shop_desc")}</p>
        </div>
        <OrderDialog orders={orders} />
      </header>

      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-zinc-500">
          <ShoppingBag className="mx-auto mb-2 h-8 w-8 text-zinc-600" />
          {t("shop.shop_empty")}
        </div>
      ) : (
        <div className="grid gap-4">
          {products.map((product) => (
            <div key={product.id} className="rounded-2xl border border-white/5 bg-zinc-900/60 p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold text-zinc-50">{product.name}</h3>
                  {product.description && (
                    <p className="mt-1 text-sm text-zinc-400">{product.description}</p>
                  )}
                </div>
                <p className="shrink-0 text-xl font-black text-primary">{product.price_egp} EGP</p>
              </div>

              {product.image_url && (
                <div className="relative mb-4 h-40 w-full overflow-hidden rounded-xl">
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 480px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
              )}

              {product.stock != null && (
                <p className="mb-3 text-xs text-zinc-500">
                  {product.stock > 0 ? t("shop.in_stock", { count: product.stock }) : t("shop.out_of_stock")}
                </p>
              )}

              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {t("shop.contact_info")}
                </p>
                <div className="space-y-2">
                  <div>
                    <Label htmlFor={`name-${product.id}`} className="text-xs text-zinc-500">
                      {t("shop.contact_name")}
                    </Label>
                    <Input
                      id={`name-${product.id}`}
                      placeholder={t("shop.contact_name_placeholder")}
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`phone-${product.id}`} className="text-xs text-zinc-500">
                      {t("shop.contact_phone")}
                    </Label>
                    <Input
                      id={`phone-${product.id}`}
                      type="tel"
                      placeholder={t("shop.contact_phone_placeholder")}
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`notes-${product.id}`} className="text-xs text-zinc-500">
                      {t("shop.contact_notes")}
                    </Label>
                    <Textarea
                      id={`notes-${product.id}`}
                      placeholder={t("shop.contact_notes_placeholder")}
                      value={contactNotes}
                      onChange={(e) => setContactNotes(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
                <Button
                  onClick={() => handleBuy(product.id)}
                  disabled={pending || buyingId === product.id}
                  className="w-full gap-2"
                  size="lg"
                >
                  {buyingId === product.id ? (
                    t("shop.processing")
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" /> {t("shop.place_order")}
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
