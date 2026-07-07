# Hamza Gym — Project Plan

A responsive full-stack gym application connecting a coach (admin) with their clients (subscribers). Built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **shadcn/ui**, and **Supabase**.

---

## 1. Overview

The app serves two distinct experiences based on user role:

- **Admin (Coach)** — manages clients, creates workout templates, approves payments, tracks revenue.
- **Subscriber (Gym Member)** — views daily workouts, logs weight, manages membership, pays via Vodafone Cash, chats with coach.

Development is phased. **Phase 1** (current) covers Subscriber Onboarding, Paywall, and the Vodafone Cash Subscription flow.

---

## 2. Tech Stack

| Layer        | Technology                                             |
| ------------ | ------------------------------------------------------ |
| Framework    | Next.js (App Router) + React 19                        |
| Language     | TypeScript                                             |
| Styling      | Tailwind CSS v3 + shadcn/ui                            |
| Icons        | lucide-react                                           |
| Database     | Supabase (PostgreSQL)                                  |
| Auth         | Supabase Auth (email/password)                         |
| File Storage | Supabase Storage (later phases)                        |
| Clients      | `@supabase/ssr` (server + browser + middleware)        |

---

## 3. Design System

Strict dark mode — there is no light mode toggle.

| Token            | Value      | Usage                                  |
| ---------------- | ---------- | -------------------------------------- |
| Background       | `zinc-950` | Global page background                 |
| Surfaces         | `zinc-900` | Cards, modals, bottom nav              |
| Borders          | `zinc-800` | Card outlines, dividers                |
| Primary text     | `zinc-50`  | Headings, body                         |
| Secondary text   | `zinc-400` | Helper text, captions                  |
| Accent / CTA     | `lime-500` | Buttons, active states, progress bars  |

- **Mobile-first subscriber UI**: bottom tab navigation, large tappable buttons.
- **Press feedback**: all interactive elements use `active:scale-[0.98]`.
- Hover states brighten accent to `lime-400`.

---

## 4. Folder Structure

```
Hamza gym/
├── app/
│   ├── layout.tsx                 # root: <html className="dark">, Toaster
│   ├── globals.css                # dark theme CSS variables
│   ├── page.tsx                   # redirect → /dashboard or /login
│   ├── (auth)/
│   │   ├── layout.tsx             # centered auth shell (logo + branding)
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (subscriber)/
│   │   ├── layout.tsx             # session + role guard, subscription gate
│   │   ├── dashboard/page.tsx     # active member home
│   │   ├── billing/page.tsx       # 5-plan grid + Vodafone modal
│   │   ├── chat/page.tsx          # placeholder
│   │   ├── location/page.tsx      # gym address card
│   │   └── workout/page.tsx       # locked stub (Phase 2)
│   └── (admin)/admin/page.tsx     # admin stub (Phase 2)
├── components/
│   ├── ui/                        # shadcn primitives (button, card, dialog…)
│   ├── auth/                      # login-form, signup-form, signout-button
│   └── subscriber/                # unpaid-landing, billing-grid, bottom-nav…
├── lib/
│   ├── config.ts                  # ALL business content (single source)
│   ├── constants.ts               # enum mirrors + status arrays
│   ├── types.ts                   # DB row types
│   ├── utils.ts                   # cn()
│   └── supabase/
│       ├── client.ts              # browser client
│       ├── server.ts              # server client
│       └── middleware.ts          # session refresh helper
├── middleware.ts                  # auth guard + session refresh
├── supabase/migrations/
│   ├── 0001_init.sql              # schema + enums + RLS + trigger
│   └── 0002_add_profile_trigger.sql  # standalone trigger (if needed)
├── .env.local.example
├── components.json
├── tailwind.config.ts
└── package.json
```

---

## 5. Database Schema

Five enum types and three tables, all protected by Row Level Security.

### Enums
- `user_role` → `admin`, `subscriber`
- `subscription_status` → `inactive`, `pending_approval`, `active`, `expired`
- `plan_type` → `1-day`, `1-month`, `3-month`, `6-month`, `1-year`
- `payment_method` → `vodafone_cash`, `manual_coach`
- `payment_request_status` → `pending`, `approved`, `rejected`

### Tables

**`profiles`** — one row per auth user (id mirrors `auth.users.id`)
| Column | Type | Default |
| --- | --- | --- |
| id | uuid (PK, FK → auth.users) | — |
| full_name | text | null |
| role | user_role | `subscriber` |
| subscription_status | subscription_status | `inactive` |
| created_at | timestamptz | `now()` |

**`subscriptions`** — granted membership periods
| Column | Type |
| --- | --- |
| id | uuid (PK) |
| user_id | uuid (FK → profiles) |
| plan_type | plan_type |
| start_date | date |
| end_date | date |
| payment_method | payment_method |
| created_at | timestamptz |

**`payment_requests`** — offline Vodafone Cash transfers awaiting approval
| Column | Type | Default |
| --- | --- | --- |
| id | uuid (PK) | — |
| user_id | uuid (FK → profiles) | — |
| plan_type | plan_type | — |
| sender_wallet_number | text | — |
| transaction_id | text | — |
| status | payment_request_status | `pending` |
| created_at | timestamptz | `now()` |

### Auto-profile trigger

A `handle_new_user()` function (SECURITY DEFINER) fires on `auth.users` insert and creates the matching `profiles` row — reading `full_name` from auth metadata. This bypasses RLS entirely and is the most reliable way to ensure every new user has a profile.

### RLS policies
- Users read/insert/update **their own** rows.
- `is_admin()` helper grants admins read + management on all tables.

---

## 6. User Flows

### 6.1 Authentication
1. **Signup** (`/signup`) — 3 fields: Full Name, Email, Password.
2. `supabase.auth.signUp()` stores `full_name` in auth metadata.
3. DB trigger auto-creates the `profiles` row (role=`subscriber`, status=`inactive`).
4. Redirect → `/dashboard`.
5. **Login** (`/login`) — Email + Password → `/dashboard`.

### 6.2 Subscription Gate (the "paywall")
The `(subscriber)` layout (`force-dynamic`) reads `subscription_status` and renders:

| Status | Screen shown |
| --- | --- |
| `inactive` / `expired` | **Unpaid Landing** — 3 cards: View Plans, Chat with Coach, Gym Location. Billing/chat/location remain accessible. |
| `pending_approval` | **Payment Waiting** — "Your payment is being verified by the coach." |
| `active` | **Full dashboard** + bottom tab nav (Home, Workouts, Coach, Gym) |

### 6.3 Vodafone Cash Payment
1. User opens `/billing`, picks a plan from the 5-card grid.
2. Modal shows coach's wallet number (copyable) + two inputs:
   - Your Vodafone Cash Wallet Number (numeric validation)
   - Transaction ID / Reference Code
3. On submit:
   - Insert `payment_requests` row (status=`pending`).
   - Update `profiles.subscription_status` → `pending_approval`.
4. Redirect → `/dashboard` now shows the waiting screen.

---

## 7. Completed — Phase 1 ✅

- [x] Project scaffolded (Next.js + TS + Tailwind + shadcn/ui)
- [x] Supabase clients (server, browser, middleware)
- [x] Auth middleware (session refresh + route protection)
- [x] Signup (3 fields) + Login (dark themed)
- [x] Auto-profile DB trigger (replaces fragile API route)
- [x] Strict dark theme tokens (zinc-950/zinc-900/lime-500)
- [x] Unpaid landing (3 options) with styled welcome
- [x] Payment waiting screen
- [x] Billing grid (5 plans) + Vodafone payment modal
- [x] Payment submit → pending_approval flow
- [x] Chat placeholder page
- [x] Gym location card + Google Maps link
- [x] Sign-out button
- [x] `force-dynamic` layout (fixes stale profile data)
- [x] SQL migration with enums, tables, RLS, trigger
- [x] `.env.local.example` + README

---

## 8. Roadmap — Future Phases

### Phase 2: Admin Dashboard
- [ ] Payment approval queue (approve/reject `payment_requests`)
- [ ] On approval: create `subscriptions` row, flip profile to `active`
- [ ] Client list with search + subscription status
- [ ] Revenue dashboard

### Phase 3: Workout Tracker
- [ ] Workout template builder (admin)
- [ ] Daily workout assignment per client
- [ ] Exercise logging + completion tracking
- [ ] Weight log chart (subscriber dashboard)

### Phase 4: Real-time Chat
- [ ] `messages` table + Supabase Realtime
- [ ] Two-way coach ↔ subscriber messaging
- [ ] Unread indicators

### Phase 5: Polish
- [ ] Email notifications (payment approved, new workouts)
- [ ] Profile photo uploads (Supabase Storage)
- [ ] Push notifications / PWA
- [ ] Plan pricing + currency in `lib/config.ts`

---

## 9. Configuration

All editable business content lives in **`lib/config.ts`**:

```ts
export const config = {
  coach: { name, vodafoneCashWallet },
  gym:   { name, address, hours, mapsUrl },
  plans: [{ id, label, price }, ...5 plans],
};
```

Environment variables (`.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

---

## 10. Local Development

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase keys
# Run supabase/migrations/0001_init.sql in Supabase SQL Editor
npm run dev                        # http://localhost:3000
```
