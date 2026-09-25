// Effective membership status.
//
// `profiles.subscription_status` is a CACHED value: it only flips to "expired"
// when the member logs in and the self-heal runs (or an admin heals it). So a
// member whose subscription has already lapsed can sit at "active" for weeks.
//
// Anything counting members MUST use the effective status below instead of the
// raw column, or the numbers disagree with each other (e.g. the clients page
// showing 32 inactive while the dashboard shows 2).

export function todayISODate(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * A member is expired if their profile says so, or if their profile still
 * says "active" but their latest subscription ended before today.
 */
export function isEffectivelyExpired(
  status: string,
  latestEndDate: string | null | undefined,
  todayStr: string = todayISODate()
): boolean {
  if (status === "active") {
    return !!latestEndDate && latestEndDate < todayStr;
  }
  return status !== "active";
}

export type MembershipBuckets = {
  /** Still inside their paid period. */
  active: number;
  /** Everything not effectively active — matches the clients page's inactive tab. */
  inactive: number;
  /** Subscribers whose paid period has lapsed (status "expired", or still "active" past end_date). */
  lapsed: number;
  /** Signed up but never activated anything. */
  neverPaid: number;
  /** Submitted a payment, waiting on coach approval. */
  awaiting: number;
  /** lapsed + awaiting — the "needs attention" total. */
  outstanding: number;
  /** All subscriber profiles. */
  total: number;
  /** Joined within the last 30 days. */
  newSignups: number;
};

/** Classify one member row into the buckets above. */
export function bucketMember(
  status: string,
  latestEndDate: string | null | undefined,
  todayStr: string = todayISODate()
) {
  if (status === "active") {
    return isEffectivelyExpired(status, latestEndDate, todayStr)
      ? ("lapsed" as const)
      : ("active" as const);
  }
  if (status === "expired") return "lapsed" as const;
  if (status === "pending_approval") return "awaiting" as const;
  return "neverPaid" as const;
}
