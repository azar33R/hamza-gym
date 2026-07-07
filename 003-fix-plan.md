# Fix Plan: 3 Additions

## 1. Shop Buy → Admin Notification

**File:** `lib/cosmetics-actions.ts`

**What:** Add `sendPushToMany` call inside `buyCosmetic()` after successful purchase.

**Steps:**
1. Import `sendPushToMany` from `@/lib/push`
2. Import `STAFF_ROLES` from `@/lib/constants`
3. After the `user_cosmetics` insert succeeds (line ~164), before `revalidatePath`:
   - Fetch buyer's `full_name` from profiles
   - Fetch all staff/admin IDs via `profiles.select("id").in("role", STAFF_ROLES)`
   - Call `sendPushToMany(staffIds, { title: "...", body: "..." }, "broadcast")`
   - Wrap in try/catch (best-effort)

---

## 2. Admin See Subscriber Phone + Email

**New file:** `lib/admin-user-actions.ts`

**What:** Server action that fetches auth user data via service-role admin API.

```typescript
import { createClient } from "@/lib/supabase/server";

export async function getUserAuthInfo(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.admin.getUserById(userId);
  if (!data?.user) return { phone: null, email: null };
  return { phone: data.user.phone ?? null, email: data.user.email ?? null };
}
```

**File:** `components/admin/user-settings-dialog.tsx`

**What:** Add contact section to Overview tab.

- Import `getUserAuthInfo`
- When dialog opens (or in a useEffect), fetch phone + email
- Display email as plain text
- Display phone with Eye/EyeOff toggle (hidden by default)
- Add new `common.phone`, `common.email` keys to JSON if needed

---

## 3. MRR Hide/Show Toggle

**File:** `components/admin/metric-card.tsx`

**What:** Add `revealable` optional prop.

- Import `Eye`, `EyeOff` from `lucide-react`
- Import `useState` from `react`
- When `revealable` is true:
  - Add a small button next to the icon with eye icon
  - `useState(false)` for `revealed`
  - When hidden: render `"•••••••"` instead of `value`
  - Toggle on click

**File:** `app/(admin)/admin/page.tsx`

**What:** Add `revealable` to MRR MetricCard.

```tsx
<MetricCard
  label={t("admin.mrr")}
  value={`${Math.round(mrr)} EGP`}
  icon={<DollarSign className="h-4 w-4" />}
  revealable
/>
```

---

## i18n Keys to Add

| Key | File | Value (en) | Value (ar) |
|-----|------|-----------|------------|
| `common.phone` | both JSON | "Phone" | "موبايل" |
| `common.email` | both JSON | "Email" | "الإيميل" |

---

## Build Verification

After all changes: `npm run build` — confirm zero errors.
