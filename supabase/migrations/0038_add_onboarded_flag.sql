-- Add an explicit "onboarded" flag so a member can skip the mandatory
-- onboarding wizard and still reach the app. Existing members who already
-- filled their physical details remain onboarded via the existing checks.
alter table public.profiles
  add column if not exists onboarded boolean not null default false;
