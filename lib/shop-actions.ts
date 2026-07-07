"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import { requireStaffOrAdmin } from "@/lib/admin";
import { sendPushToUser } from "@/lib/push";
import type { ShopProduct, ShopOrder, ShopOrderStatus } from "@/lib/types";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function currentUserId(): Promise<string | null> {
  const ssr = await createSSRClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  return user?.id ?? null;
}

// The live product catalog (members browse + order from this).
export async function getActiveProducts(): Promise<{
  error: string | null;
  products: ShopProduct[];
}> {
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("shop_products")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error || !data) return { error: error?.message ?? "Couldn't load shop.", products: [] };
  return { error: null, products: data as ShopProduct[] };
}

// The caller's own orders (member side — to show pending/paid status).
export async function getMyOrders(): Promise<{
  error: string | null;
  orders: (ShopOrder & { product_name: string | null })[];
}> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in.", orders: [] };

  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("shop_orders")
    .select("id, product_id, price_egp_snapshot, status, sender_wallet, txn_id, reviewed_at, created_at, shop_products(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return { error: error?.message ?? "Couldn't load orders.", orders: [] };

  return {
    error: null,
    orders: (data as unknown as (ShopOrder & { shop_products: { name: string | null } | null })[]).map(
      (o) => ({ ...o, product_name: o.shop_products?.name ?? null })
    ),
  };
}

// Place an order against a product, capturing the buyer's contact info so the
// admin can reach out via chat. Snapshots the price so later catalog edits
// don't rewrite history.
export async function createOrder(data: {
  productId: string;
  contactName: string;
  contactPhone: string;
  contactNotes: string;
}): Promise<{ error: string | null }> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in." };

  const name = data.contactName.trim();
  const phone = data.contactPhone.trim();
  if (!name || !phone) return { error: "Name and phone number are required." };

  const supabase = serviceClient();

  const { data: product } = await supabase
    .from("shop_products")
    .select("price_egp, is_active, stock")
    .eq("id", data.productId)
    .single<ShopProduct>();
  if (!product) return { error: "Product not found." };
  if (!product.is_active) return { error: "This product is unavailable." };
  if (product.stock != null && product.stock <= 0) {
    return { error: "This product is out of stock." };
  }

  const { error } = await supabase.from("shop_orders").insert({
    user_id: userId,
    product_id: data.productId,
    price_egp_snapshot: product.price_egp,
    status: "pending",
    contact_name: name,
    contact_phone: phone,
    contact_notes: data.contactNotes.trim() || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/shop");
  return { error: null };
}

// ---------------------------------------------------------------------------
//  Admin: product CRUD + order lifecycle
// ---------------------------------------------------------------------------
export async function upsertProduct(
  productId: string | null,
  data: {
    name: string;
    description: string;
    price_egp: number;
    image_url: string | null;
    stock: number | null;
    is_active: boolean;
  }
): Promise<{ error: string | null }> {
  await requireStaffOrAdmin();
  if (!data.name.trim()) return { error: "Name is required." };
  if (data.price_egp < 0) return { error: "Price must be 0 or more." };

  const supabase = serviceClient();
  const payload = {
    name: data.name.trim(),
    description: data.description.trim() || null,
    price_egp: data.price_egp,
    image_url: data.image_url?.trim() || null,
    stock: data.stock,
    is_active: data.is_active,
  };

  let error;
  if (productId) {
    ({ error } = await supabase.from("shop_products").update(payload).eq("id", productId));
  } else {
    ({ error } = await supabase.from("shop_products").insert(payload));
  }
  if (error) return { error: error.message };

  revalidatePath("/admin/shop");
  revalidatePath("/shop");
  return { error: null };
}

export async function deleteProduct(productId: string): Promise<{ error: string | null }> {
  await requireStaffOrAdmin();
  const supabase = serviceClient();

  // First remove fulfilled/rejected orders so the FK doesn't block deletion.
  await supabase
    .from("shop_orders")
    .delete()
    .eq("product_id", productId)
    .in("status", ["fulfilled", "rejected"]);

  const { error } = await supabase.from("shop_products").delete().eq("id", productId);
  if (error) {
    if (error.message?.includes("foreign key constraint")) {
      return { error: "Cannot delete — this product has pending or approved orders. Deactivate it instead." };
    }
    return { error: error.message };
  }
  revalidatePath("/admin/shop");
  revalidatePath("/shop");
  return { error: null };
}

// Delete a fulfilled or rejected order (cleanup).
const DELETABLE_STATUSES: ShopOrderStatus[] = ["fulfilled", "rejected"];
export async function deleteOrder(orderId: string): Promise<{ error: string | null }> {
  await requireStaffOrAdmin();
  const supabase = serviceClient();

  const { data: order } = await supabase
    .from("shop_orders")
    .select("status")
    .eq("id", orderId)
    .single<Pick<ShopOrder, "status">>();
  if (!order) return { error: "Order not found." };
  if (!DELETABLE_STATUSES.includes(order.status)) {
    return { error: "Only fulfilled or rejected orders can be deleted." };
  }

  const { error } = await supabase.from("shop_orders").delete().eq("id", orderId);
  if (error) return { error: error.message };

  revalidatePath("/admin/shop");
  return { error: null };
}

// All orders with the buyer + product for the admin table.
export type AdminShopOrder = ShopOrder & {
  member_name: string | null;
  product_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_notes: string | null;
};

export async function getAdminOrders(): Promise<{
  error: string | null;
  orders: AdminShopOrder[];
}> {
  await requireStaffOrAdmin();
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("shop_orders")
    .select("id, user_id, product_id, price_egp_snapshot, status, sender_wallet, txn_id, contact_name, contact_phone, contact_notes, reviewed_at, created_at, profiles(full_name), shop_products(name)")
    .order("created_at", { ascending: false });

  if (error || !data) return { error: error?.message ?? "Couldn't load orders.", orders: [] };

  return {
    error: null,
    orders: (data as unknown as (ShopOrder & {
      profiles: { full_name: string | null } | null;
      shop_products: { name: string | null } | null;
    })[]).map((o) => ({
      ...o,
      member_name: o.profiles?.full_name ?? null,
      product_name: o.shop_products?.name ?? null,
      contact_name: o.contact_name ?? null,
      contact_phone: o.contact_phone ?? null,
      contact_notes: o.contact_notes ?? null,
    })),
  };
}

async function setOrderStatus(
  orderId: string,
  status: "approved" | "rejected" | "fulfilled"
): Promise<{ error: string | null }> {
  await requireStaffOrAdmin();
  const supabase = serviceClient();

  const { error } = await supabase
    .from("shop_orders")
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) return { error: error.message };

  // Notify the member.
  const { data: order } = await supabase
    .from("shop_orders")
    .select("user_id, product_id")
    .eq("id", orderId)
    .single();
  if (order) {
    const label =
      status === "approved"
        ? "Order Confirmed"
        : status === "fulfilled"
        ? "Order Ready"
        : "Order Update";
    const body =
      status === "approved"
        ? "Your shop order was confirmed. We'll let you know when it's ready."
        : status === "fulfilled"
        ? "Your shop order is ready for pickup! 🎉"
        : "Your shop order couldn't be verified. Please contact the gym.";
    try {
      await sendPushToUser(order.user_id, { title: label, body }, "payment");
    } catch {
      // best-effort
    }
  }

  revalidatePath("/admin/shop");
  return { error: null };
}

export const approveOrder = async (id: string) => setOrderStatus(id, "approved");
export const fulfillOrder = async (id: string) => setOrderStatus(id, "fulfilled");
export const rejectOrder = async (id: string) => setOrderStatus(id, "rejected");
