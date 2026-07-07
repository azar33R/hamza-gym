import { requireStaffOrAdmin } from "@/lib/admin";
import { createClient } from "@supabase/supabase-js";
import { getAdminOrders } from "@/lib/shop-actions";
import { AdminShop } from "@/components/admin/admin-shop";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const dynamic = "force-dynamic";

export default async function AdminShopPage() {
  const { role } = await requireStaffOrAdmin();
  const supabase = serviceClient();

  const { data: products } = await supabase
    .from("shop_products")
    .select("*")
    .order("created_at", { ascending: false });

  const { orders } = await getAdminOrders();

  return (
    <AdminShop
      isAdmin={role === "admin"}
      products={(products ?? []) as import("@/lib/types").ShopProduct[]}
      orders={orders}
    />
  );
}
