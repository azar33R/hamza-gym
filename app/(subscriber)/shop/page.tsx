import { createClient } from "@/lib/supabase/server";
import { getActiveProducts, getMyOrders } from "@/lib/shop-actions";
import { ProShop } from "@/components/subscriber/pro-shop";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ products }, { orders }] = await Promise.all([
    getActiveProducts(),
    getMyOrders(),
  ]);

  return (
    <ProShop
      userId={user!.id}
      products={products}
      orders={orders}
    />
  );
}
