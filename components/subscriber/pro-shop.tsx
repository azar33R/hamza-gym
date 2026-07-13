"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ShoppingBag, CreditCard, Clock, Package, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
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
                    <p className="text-xs text-zinc-500">
                      {o.price_egp_snapshot} EGP{o.cardio ? ` · ${t("shop.cardio")}` : ""}
                    </p>
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

function BuyDialog({
  product,
  onOrdered,
}: {
  product: ShopProduct;
  onOrdered: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactNotes, setContactNotes] = useState("");
  const [cardio, setCardio] = useState(false);
  const [pending, startTransition] = useTransition();

  const hasCardio = product.cardio_price > 0;
  const total =
    product.price_egp + (cardio && hasCardio ? product.cardio_price : 0);

  function reset() {
    setContactName("");
    setContactPhone("");
    setContactNotes("");
    setCardio(false);
  }

  function handleBuy() {
    if (!contactName.trim() || !contactPhone.trim()) {
      toast.error(t("shop.enter_contact_info"));
      return;
    }
    startTransition(async () => {
      const res = await createOrder({
        productId: product.id,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        contactNotes: contactNotes.trim(),
        cardio,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("shop.order_placed"));
        reset();
        setOpen(false);
        onOrdered();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button className="w-full gap-2" size="sm">
          <CreditCard className="h-4 w-4" /> {t("shop.place_order")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {product.name}
          </DialogTitle>
          <DialogDescription>
            {total} EGP · {t("shop.contact_info")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor={`bd-name-${product.id}`} className="text-xs text-zinc-500">
              {t("shop.contact_name")}
            </Label>
            <Input
              id={`bd-name-${product.id}`}
              placeholder={t("shop.contact_name_placeholder")}
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`bd-phone-${product.id}`} className="text-xs text-zinc-500">
              {t("shop.contact_phone")}
            </Label>
            <Input
              id={`bd-phone-${product.id}`}
              type="tel"
              placeholder={t("shop.contact_phone_placeholder")}
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`bd-notes-${product.id}`} className="text-xs text-zinc-500">
              {t("shop.contact_notes")}
            </Label>
            <Textarea
              id={`bd-notes-${product.id}`}
              placeholder={t("shop.contact_notes_placeholder")}
              value={contactNotes}
              onChange={(e) => setContactNotes(e.target.value)}
              rows={2}
            />
          </div>

          {hasCardio && (
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-zinc-950/40 p-3 text-sm text-zinc-200">
              <input
                type="checkbox"
                id={`bd-cardio-${product.id}`}
                checked={cardio}
                onChange={(e) => setCardio(e.target.checked)}
                className="h-4 w-4 accent-lime-500"
              />
              <span className="flex-1">{t("shop.add_cardio", { price: product.cardio_price })}</span>
            </label>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button variant="ghost">{t("common.cancel")}</Button>
          </DialogClose>
          <Button onClick={handleBuy} disabled={pending} className="gap-2">
            {pending ? t("shop.processing") : (
              <>
                <CreditCard className="h-4 w-4" /> {t("shop.place_order")}
              </>
            )}
          </Button>
        </DialogFooter>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/60"
            >
              <div className="relative h-40 w-full bg-zinc-950">
                {product.image_url ? (
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    fill
                    sizes="(max-width: 640px) 100vw, 320px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-zinc-700">
                    <ImageOff className="h-8 w-8" />
                  </div>
                )}
                <span className="absolute end-3 top-3 rounded-full bg-zinc-950/80 px-2.5 py-1 text-sm font-black text-primary">
                  {product.price_egp} EGP
                </span>
              </div>

              <div className="flex flex-1 flex-col p-4">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <h3 className="text-base font-bold text-zinc-50">{product.name}</h3>
                </div>
                {product.description && (
                  <p className="mb-3 line-clamp-2 text-sm text-zinc-400">
                    {product.description}
                  </p>
                )}
                {product.cardio_price > 0 && (
                  <p className="mb-3 text-xs text-zinc-500">
                    {t("shop.cardio_option", { price: product.cardio_price })}
                  </p>
                )}

                <div className="mt-auto space-y-3">
                  {product.stock != null && (
                    <p className="text-xs text-zinc-500">
                      {product.stock > 0
                        ? t("shop.in_stock", { count: product.stock })
                        : t("shop.out_of_stock")}
                    </p>
                  )}
                  <BuyDialog product={product} onOrdered={() => {}} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
