import type {
  UserRole,
  SubscriptionStatus,
  PlanType,
  PaymentMethod,
  PaymentRequestStatus,
  Tier,
  WorkoutPath,
} from "@/lib/constants";

// Re-export so consumers can import all row + enum types from one place.
export type {
  UserRole,
  SubscriptionStatus,
  PlanType,
  PaymentMethod,
  PaymentRequestStatus,
  Tier,
  WorkoutPath,
};

// ----------------------------------------------------------------------------
//  Database row types — mirror the Supabase migrations.
// ----------------------------------------------------------------------------

export type Profile = {
  id: string; // uuid, == auth.users.id
  full_name: string | null;
  role: UserRole;
  subscription_status: SubscriptionStatus;
  created_at: string;
  // Phase 2 additions (nullable until populated):
  height_cm?: number | null;
  weight_kg?: number | null;
  gender?: string | null;
  last_workout_date?: string | null;
  last_attendance_date?: string | null;
  // Phase 4 additions:
  age?: number | null;
  face_photo_url?: string | null;
  workout_path?: WorkoutPath | null;
  // Points economy (was total_xp). A SINGLE spendable balance: earning raises
  // it, buying cosmetics lowers it. The leaderboard ranks this exact number
  // and tier is derived from it too.
  points?: number;
  current_tier?: Tier;
};

export type Subscription = {
  id: string;
  user_id: string;
  plan_type: PlanType;
  start_date: string | null;
  end_date: string | null;
  payment_method: PaymentMethod;
  created_at: string;
};

export type PaymentRequest = {
  id: string;
  user_id: string;
  plan_type: PlanType;
  sender_wallet_number: string;
  transaction_id: string;
  cardio: boolean;
  cardio_price_snapshot: number;
  status: PaymentRequestStatus;
  created_at: string;
};

// Phase 2:

export type Plan = {
  id: string;
  plan_type: PlanType;
  label: string;
  price_egp: number;
  cardio_price: number;
  duration_months: number; // 0 = 1-day pass
  features: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type SubscriptionCode = {
  id: string;
  code: string;
  plan_type: PlanType;
  label: string | null;
  max_uses: number;
  used_count: number;
  created_by: string | null;
  redeemed_by: string | null;
  redeemed_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

export type Exercise = {
  name: string;
  sets: number;
  reps: number;
  // Phase 4: optional link to a machine_library row.
  machine_id?: string | null;
  // Denormalized photo for quick rendering during a workout.
  photo_url?: string | null;
};

export type WorkoutTemplate = {
  id: string;
  name: string;
  description: string | null;
  exercises: Exercise[];
  created_by: string | null;
  created_at: string;
};

export type ScheduledWorkout = {
  id: string;
  user_id: string;
  template_id: string;
  scheduled_date: string;
  created_at: string;
};

// A subscriber-authored routine. Same exercise shape as workout_templates but
// owned by the member (not shared with the coach).
export type UserWorkoutTemplate = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  exercises: Exercise[];
  created_at: string;
};

export type NotificationType = "nudge" | "broadcast" | "payment" | "dm";

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: NotificationType;
  is_read: boolean;
  link: string | null;
  created_at: string;
};

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
};

export type AttendanceLog = {
  id: string;
  user_id: string;
  checked_in_at: string;
  created_at: string;
};

// Phase 4:

export type GymSettings = {
  id: number;
  daily_pin: string;
  updated_at: string;
};

export type Machine = {
  id: string;
  name: string;
  photo_url: string | null;
  primary_muscle: string | null;
  created_at: string;
};

export type PersonalRecord = {
  id: string;
  user_id: string;
  exercise_name: string;
  max_weight: number;
  calculated_ratio: number | null;
  verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
};

// A point ledger entry. kind 'earn' raises the single balance; 'spend' lowers
// it (stored as a negative amount). `amount` is signed.
export type PointTransaction = {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  kind: "earn" | "spend";
  related_cosmetic_id: string | null;
  created_at: string;
};

// Backwards-compatible alias for any caller still importing XpTransaction.
export type XpTransaction = PointTransaction;

// ----------------------------------------------------------------------------
//  Cosmetics (nicknames + banners)
// ----------------------------------------------------------------------------
export type CosmeticType = "nickname" | "banner";

export type Cosmetic = {
  id: string;
  type: CosmeticType;
  name: string;
  value: string;
  price_points: number | null;
  unlock_tier: Tier | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type UserCosmetic = {
  user_id: string;
  cosmetic_id: string;
  acquired_at: string;
  equipped: boolean;
};

// ----------------------------------------------------------------------------
//  Pro Shop (real-money products)
// ----------------------------------------------------------------------------
export type ShopOrderStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "fulfilled";

export type ShopProduct = {
  id: string;
  name: string;
  description: string | null;
  price_egp: number;
  image_url: string | null;
  stock: number | null;
  is_active: boolean;
  created_at: string;
};

export type ShopOrder = {
  id: string;
  user_id: string;
  product_id: string;
  price_egp_snapshot: number;
  status: ShopOrderStatus;
  sender_wallet: string | null;
  txn_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
};

// ----------------------------------------------------------------------------
//  Lift verification queue
// ----------------------------------------------------------------------------
export type LiftStatus = "pending" | "approved" | "rejected";

export type LiftSubmission = {
  id: string;
  user_id: string;
  exercise_name: string;
  weight: number;
  calculated_ratio: number | null;
  status: LiftStatus;
  reject_reason: string | null;
  reviewer_id: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type WorkoutSession = {
  id: string;
  user_id: string;
  template_id: string | null;
  started_at: string;
  completed_at: string | null;
};

export type SetLog = {
  id: string;
  session_id: string;
  exercise_name: string;
  set_number: number;
  weight: number | null;
  reps: number | null;
  machine_id: string | null;
  created_at: string;
};

// Phase 5: subscriber ↔ coach direct messages.

export type ChatMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};
