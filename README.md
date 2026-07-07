# Hamza Gym

A responsive full-stack gym app for a coach (admin) and their clients (subscribers). Phase 1 covers **Subscriber Onboarding, Paywall, and the Vodafone Cash subscription flow**.

Built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **shadcn/ui**, and **Supabase**.

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your Supabase project credentials:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Apply the database schema

Open the Supabase Dashboard → **SQL Editor**, paste the contents of
[`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql), and run it. This creates the `profiles`, `subscriptions`, and `payment_requests` tables (with enum types + Row Level Security).

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Customising your content

All business content lives in **[`lib/config.ts`](./lib/config.ts)** — edit one file to set:

- Coach name + Vodafone Cash wallet number
- Gym name, address, opening hours, and Google Maps link
- Plan labels + prices

---

## Architecture

### Roles & access

| Role        | Area        | Entry point  |
| ----------- | ----------- | ------------ |
| `subscriber`| Dashboard   | `/dashboard` |
| `admin`     | Admin panel | `/admin`     |

Middleware (`middleware.ts`) refreshes the Supabase session on every request and redirects unauthenticated users to `/login`.

### The subscriber "gate"

The `(subscriber)` layout reads each user's `subscription_status` and renders accordingly:

| Status              | What the user sees                                      |
| ------------------- | ------------------------------------------------------- |
| `inactive` / `expired` | The **unpaid landing** — 3 options: Plans, Chat, Gym |
| `pending_approval`  | A **"payment being verified"** waiting screen           |
| `active`            | The full subscriber dashboard + bottom-tab navigation   |

### Vodafone Cash flow

1. On `/billing` the subscriber picks a plan.
2. A modal shows the coach's wallet number and asks for the sender's wallet number + transaction ID.
3. On submit, a row is inserted into `payment_requests` and the profile flips to `pending_approval`.
4. The subscriber sees the waiting screen until the coach approves (admin tooling arrives in a later phase).

---

## Tech notes

- **Strict dark theme**: `zinc-950` background, `zinc-900` surfaces, `lime-500` accent. Enforced via `<html className="dark">` — there is no light mode.
- **Mobile-first subscriber UI**: bottom tab navigation, large tappable buttons with `active:scale` press feedback.
- **RLS** protects every table — users only read/write their own rows; admins can see and manage all.

---

## Roadmap (later phases)

- Real-time coach chat
- Workout tracker + daily plans
- Admin payment-approval workflow
- Weight logging
