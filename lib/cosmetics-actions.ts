"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import type { Cosmetic, CosmeticType, UserCosmetic } from "@/lib/types";
import type { Tier } from "@/lib/constants";

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

// The catalog grouped for the shop UI, plus everything the caller owns + has
// equipped. A cosmetic is acquirable when it's buyable (price_points set) OR the
// caller's tier has reached its unlock_tier (free at tier).
export type ShopCosmetic = Cosmetic & {
  owned: boolean;
  equipped: boolean;
  freeForTier: boolean; // caller's current tier meets unlock_tier
};

export type CosmeticsShop = {
  nicknames: ShopCosmetic[];
  banners: ShopCosmetic[];
  ownedCount: number;
};

export async function getMyCosmetics(): Promise<{
  error: string | null;
  shop: CosmeticsShop | null;
}> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in.", shop: null };

  const supabase = serviceClient();

  const { data: caller } = await supabase
    .from("profiles")
    .select("current_tier")
    .eq("id", userId)
    .single();
  const tierRank: Record<Tier, number> = { iron: 0, bronze: 1, gold: 2, diamond: 3 };
  const myTierRank = tierRank[(caller?.current_tier ?? "iron") as Tier] ?? 0;

  const [catalogRes, ownedRes] = await Promise.all([
    supabase
      .from("cosmetics")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("user_cosmetics")
      .select("cosmetic_id, equipped")
      .eq("user_id", userId),
  ]);

  if (catalogRes.error || !catalogRes.data) {
    return { error: catalogRes.error?.message ?? "Couldn't load cosmetics.", shop: null };
  }

  const ownedMap = new Map<string, boolean>();
  for (const row of (ownedRes.data ?? []) as Pick<UserCosmetic, "cosmetic_id" | "equipped">[]) {
    ownedMap.set(row.cosmetic_id, row.equipped);
  }

  const enrich = (c: Cosmetic): ShopCosmetic => ({
    ...c,
    owned: ownedMap.has(c.id),
    equipped: ownedMap.get(c.id) === true,
    freeForTier:
      c.unlock_tier != null &&
      (tierRank[c.unlock_tier] ?? 0) <= myTierRank,
  });

  const all = (catalogRes.data as Cosmetic[]).map(enrich);

  return {
    error: null,
    shop: {
      nicknames: all.filter((c) => c.type === "nickname"),
      banners: all.filter((c) => c.type === "banner"),
      ownedCount: ownedMap.size,
    },
  };
}

// Buy a cosmetic. Spends points via the spend_points RPC (atomic), then grants
// the row. If the caller already owns it or qualifies for a free tier unlock,
// no points are spent — just granted.
export async function buyCosmetic(
  cosmeticId: string
): Promise<{ error: string | null }> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in." };

  const supabase = serviceClient();

  const { data: cosmetic } = await supabase
    .from("cosmetics")
    .select("*")
    .eq("id", cosmeticId)
    .single<Cosmetic>();
  if (!cosmetic) return { error: "Item not found." };

  // Already owned? Nothing to do.
  const { data: already } = await supabase
    .from("user_cosmetics")
    .select("cosmetic_id")
    .eq("user_id", userId)
    .eq("cosmetic_id", cosmeticId)
    .maybeSingle();
  if (already) {
    revalidatePath("/cosmetics");
    return { error: null };
  }

  // Free if the caller's tier qualifies — grant without spending.
  const { data: caller } = await supabase
    .from("profiles")
    .select("current_tier")
    .eq("id", userId)
    .single();
  const tierRank: Record<Tier, number> = { iron: 0, bronze: 1, gold: 2, diamond: 3 };
  const myTierRank = tierRank[(caller?.current_tier ?? "iron") as Tier] ?? 0;
  const freeForTier =
    cosmetic.unlock_tier != null &&
    (tierRank[cosmetic.unlock_tier] ?? 0) <= myTierRank;

  if (!freeForTier) {
    // Must be buyable.
    if (cosmetic.price_points == null) {
      return { error: "This item can't be bought." };
    }
    const { data: spent, error: spendErr } = await supabase.rpc("spend_points", {
      p_user_id: userId,
      p_amount: cosmetic.price_points,
      p_reason: `Bought ${cosmetic.type}: ${cosmetic.name}`,
      p_cosmetic_id: cosmeticId,
    });
    if (spendErr) return { error: spendErr.message };
    const ok = (spent as { ok: boolean }[] | null)?.[0]?.ok;
    if (!ok) {
      return { error: "Not enough points for this item." };
    }
  }

  const { error: grantErr } = await supabase.from("user_cosmetics").insert({
    user_id: userId,
    cosmetic_id: cosmeticId,
    equipped: false,
  });
  if (grantErr) return { error: grantErr.message };

  revalidatePath("/cosmetics");
  revalidatePath("/dashboard");
  return { error: null };
}

// Equip an owned cosmetic (one equipped per type, enforced by the equip RPC).
export async function equipCosmetic(
  cosmeticId: string
): Promise<{ error: string | null }> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in." };

  const supabase = serviceClient();
  const { data, error } = await supabase.rpc("equip_cosmetic", {
    p_user_id: userId,
    p_cosmetic_id: cosmeticId,
  });
  if (error) return { error: error.message };
  const ok = (data as { ok: boolean }[] | null)?.[0]?.ok;
  if (!ok) return { error: "Equip this item first." };

  revalidatePath("/cosmetics");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  return { error: null };
}

// Un-equip an owned cosmetic.
export async function unequipCosmetic(
  cosmeticId: string
): Promise<{ error: string | null }> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in." };

  const supabase = serviceClient();
  const { error } = await supabase.rpc("unequip_cosmetic", {
    p_user_id: userId,
    p_cosmetic_id: cosmeticId,
  });
  if (error) return { error: error.message };

  revalidatePath("/cosmetics");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  return { error: null };
}

// ---------------------------------------------------------------------------
//  Admin catalog management (requireAdmin)
// ---------------------------------------------------------------------------
export async function upsertCosmetic(
  cosmeticId: string | null,
  data: {
    type: CosmeticType;
    name: string;
    value: string;
    price_points: number | null;
    unlock_tier: Tier | null;
    is_active: boolean;
    sort_order: number;
  }
): Promise<{ error: string | null }> {
  await requireAdmin();
  if (!data.name.trim()) return { error: "Name is required." };
  if (!data.value.trim()) return { error: "Value is required." };
  if (data.price_points == null && data.unlock_tier == null) {
    return { error: "Set a points price or a tier unlock (or both)." };
  }

  const supabase = serviceClient();
  const payload = {
    type: data.type,
    name: data.name.trim(),
    value: data.value.trim(),
    price_points: data.price_points,
    unlock_tier: data.unlock_tier,
    is_active: data.is_active,
    sort_order: data.sort_order,
  };

  let error;
  if (cosmeticId) {
    ({ error } = await supabase.from("cosmetics").update(payload).eq("id", cosmeticId));
  } else {
    ({ error } = await supabase.from("cosmetics").insert(payload));
  }
  if (error) return { error: error.message };

  revalidatePath("/admin/cosmetics");
  revalidatePath("/cosmetics");
  return { error: null };
}

export async function deleteCosmetic(cosmeticId: string): Promise<{ error: string | null }> {
  await requireAdmin();
  const supabase = serviceClient();
  const { error } = await supabase.from("cosmetics").delete().eq("id", cosmeticId);
  if (error) return { error: error.message };
  revalidatePath("/admin/cosmetics");
  revalidatePath("/cosmetics");
  return { error: null };
}
