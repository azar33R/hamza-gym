"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/client";
import { toast } from "sonner";
import Image from "next/image";
import { ShoppingBag, Package, Plus, CheckCircle2, XCircle, Truck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Trash2 } from "lucide-react";
import { uploadShopProductPhoto } from "@/lib/storage";
import { upsertProduct, deleteProduct, deleteOrder, approveOrder, fulfillOrder, rejectOrder } from "@/lib/shop-actions";
import type { ShopProduct, ShopOrder } from "@/lib/types";
import type { AdminShopOrder } from "@/lib/shop-actions";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, { class: string }> = {
  pending: { class: "bg-amber-500/15 text-amber-400" },
  approved: { class: "bg-emerald-500/15 text-emerald-400" },
  rejected: { class: "bg-red-500/15 text-red-400" },
  fulfilled: { class: "bg-blue-500/15 text-blue-400" },
};

function ProductForm({
  product,
  onClose,
}: {
  product?: ShopProduct | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(String(product?.price_egp ?? ""));
  const [cardioPrice, setCardioPrice] = useState(String(product?.cardio_price ?? ""));
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? "");
  const [uploadPending, setUploadPending] = useState(false);
  const [stock, setStock] = useState(String(product?.stock ?? ""));
  const [active, setActive] = useState(product?.is_active ?? true);
  const [pending, startTransition] = useTransition();

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadPending(true);
    const res = await uploadShopProductPhoto(file);
    if (res.error) {
      toast.error(res.error);
    } else if (res.url) {
      setImageUrl(res.url);
    }
    setUploadPending(false);
  }

  async function handleSave() {
    const stockNum = stock === "" ? null : Number(stock);
    startTransition(async () => {
      const res = await upsertProduct(product?.id ?? null, {
        name,
        description,
        price_egp: Number(price),
        cardio_price: Number(cardioPrice) || 0,
        image_url: imageUrl || null,
        stock: stockNum,
        is_active: active,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(product ? t("admin.shop.updated") : t("admin.shop.created"));
        onClose();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="p-name">{t("admin.shop.name")}</Label>
        <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="p-desc">{t("admin.shop.description")}</Label>
        <Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="p-price">{t("admin.shop.price")}</Label>
          <Input id="p-price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="p-stock">{t("admin.shop.stock")}</Label>
          <Input id="p-stock" type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <Label htmlFor="p-cardio">{t("admin.shop.cardio_price")}</Label>
          <Input id="p-cardio" type="number" min={0} value={cardioPrice} onChange={(e) => setCardioPrice(e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="p-img">{t("admin.shop.image_url")}</Label>
        <div className="flex items-center gap-2">
          <Input id="p-img" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
          <Label
            htmlFor="p-img-upload"
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
          >
            <Upload className="h-3.5 w-3.5" />
            {uploadPending ? t("common.uploading") : t("admin.shop.upload")}
          </Label>
          <input
            id="p-img-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
            disabled={uploadPending}
          />
        </div>
        {imageUrl && (
          <div className="relative mt-2 h-24 w-full overflow-hidden rounded-lg">
            <Image
              src={imageUrl}
              alt="preview"
              fill
              sizes="200px"
              className="object-cover"
              unoptimized
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="p-active"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        <Label htmlFor="p-active" className="text-sm">{t("common.active")}</Label>
      </div>
      <Button onClick={handleSave} disabled={pending} className="w-full">
        {pending ? t("common.saving") : product ? t("admin.shop.edit_product") : t("admin.shop.add_product")}
      </Button>
    </div>
  );
}

export function AdminShop({
  isAdmin,
  products,
  orders,
}: {
  isAdmin: boolean;
  products: ShopProduct[];
  orders: AdminShopOrder[];
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<ShopProduct | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [_, startTransition] = useTransition();

  async function handleDelete(id: string) {
    if (!confirm(t("admin.shop.delete_confirm"))) return;
    setPendingId(id);
    startTransition(async () => {
      const res = await deleteProduct(id);
      if (res.error) toast.error(res.error);
      else toast.success(t("admin.shop.deleted"));
      setPendingId(null);
    });
  }

  async function handleDeleteOrder(id: string) {
    if (!confirm(t("admin.shop.delete_order_confirm"))) return;
    setPendingId(id);
    startTransition(async () => {
      const res = await deleteOrder(id);
      if (res.error) toast.error(res.error);
      else toast.success(t("admin.shop.order_deleted"));
      setPendingId(null);
    });
  }

  async function handleOrderAction(
    orderId: string,
    action: "approve" | "reject" | "fulfill"
  ) {
    setPendingId(orderId);
    startTransition(async () => {
      const fn = action === "approve" ? approveOrder : action === "fulfill" ? fulfillOrder : rejectOrder;
      const res = await fn(orderId);
      if (res?.error) toast.error(res.error);
      else toast.success(t("admin.shop.order_actioned", { action }));
      setPendingId(null);
    });
  }

  const pendingOrders = orders.filter((o) => o.status === "pending");

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-50">
            <ShoppingBag className="h-6 w-6 text-primary" /> {t("admin.shop.title")}
          </h1>
          <p className="text-sm text-zinc-400">{t("admin.shop.desc")}</p>
        </div>
      </header>

      <Tabs defaultValue="orders">
        <TabsList className="w-full">
          <TabsTrigger value="orders" className="gap-1.5">
            {t("admin.shop.orders_tab")}
            {pendingOrders.length > 0 && (
              <Badge variant="muted" className="ms-1">{pendingOrders.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-1.5">
            {t("admin.shop.products_tab")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-4 space-y-3">
          {orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-zinc-500">
              {t("admin.shop.no_orders")}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.shop.member")}</TableHead>
                    <TableHead>{t("admin.shop.product")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("admin.shop.amount")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("admin.shop.contact")}</TableHead>
                    <TableHead>{t("admin.shop.status")}</TableHead>
                    <TableHead className="text-end">{t("admin.shop.action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium text-zinc-50">{o.member_name ?? "—"}</TableCell>
                      <TableCell className="text-zinc-300">{o.product_name ?? "—"}</TableCell>
                      <TableCell className="hidden text-zinc-400 sm:table-cell">{o.price_egp_snapshot} EGP</TableCell>
                      <TableCell className="hidden text-zinc-300 lg:table-cell">
                        {(o as any).contact_name ? (
                          <span title={`${(o as any).contact_phone ?? ""}${(o as any).contact_notes ? ` — ${(o as any).contact_notes}` : ""}`}>
                            {(o as any).contact_name}
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                          STATUS_STYLES[o.status]?.class
                        )}>
                          {t(`admin.shop.status.${o.status}`)}
                        </span>
                      </TableCell>
                      <TableCell className="text-end">
                        {o.status === "pending" && (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOrderAction(o.id, "approve")}
                              disabled={pendingId === o.id}
                              className="text-emerald-400"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOrderAction(o.id, "reject")}
                              disabled={pendingId === o.id}
                              className="text-red-400"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        {o.status === "approved" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOrderAction(o.id, "fulfill")}
                            disabled={pendingId === o.id}
                            className="gap-1"
                          >
                            <Truck className="h-3 w-3" /> {t("admin.shop.fulfill")}
                          </Button>
                        )}
                        {(o.status === "fulfilled" || o.status === "rejected") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteOrder(o.id)}
                            disabled={pendingId === o.id}
                            className="text-zinc-500 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="products" className="mt-4 space-y-3">
          {isAdmin && (
            <Dialog open={showNew} onOpenChange={setShowNew}>
              <DialogTrigger asChild>
                <Button className="gap-1.5">
                  <Plus className="h-4 w-4" /> {t("admin.shop.add_product")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("admin.shop.new_product")}</DialogTitle>
                  <DialogDescription>{t("admin.shop.add_product_desc")}</DialogDescription>
                </DialogHeader>
                <ProductForm onClose={() => setShowNew(false)} />
              </DialogContent>
            </Dialog>
          )}

          {products.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-zinc-500">
              {t("admin.shop.no_products")}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.shop.name")}</TableHead>
                    <TableHead>{t("admin.shop.price")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("admin.shop.stock")}</TableHead>
                    <TableHead>{t("common.active")}</TableHead>
                    {isAdmin && <TableHead className="text-end">{t("common.actions")}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-zinc-50">{p.name}</TableCell>
                      <TableCell className="text-zinc-300">{p.price_egp} EGP</TableCell>
                      <TableCell className="hidden text-zinc-400 sm:table-cell">
                        {p.stock != null ? p.stock : "—"}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase",
                          p.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-500/15 text-zinc-400"
                        )}>
                          {p.is_active ? t("common.yes") : t("common.no")}
                        </span>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-end">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditing(p)}
                            >
                              {t("common.edit")}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(p.id)}
                              disabled={pendingId === p.id}
                              className="text-red-400"
                            >
                              {t("common.delete")}
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("admin.shop.edit_product")}</DialogTitle>
                <DialogDescription>{t("admin.shop.edit_product_desc")}</DialogDescription>
              </DialogHeader>
              {editing && <ProductForm product={editing} onClose={() => setEditing(null)} />}
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
