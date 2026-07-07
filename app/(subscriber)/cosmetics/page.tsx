import { createClient } from "@/lib/supabase/server";
import { getMyCosmetics } from "@/lib/cosmetics-actions";
import { CosmeticsShop } from "@/components/subscriber/cosmetics-shop";

export const dynamic = "force-dynamic";

export default async function CosmeticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { shop } = await getMyCosmetics();

  return (
    <CosmeticsShop userId={user!.id} shop={shop} />
  );
}
