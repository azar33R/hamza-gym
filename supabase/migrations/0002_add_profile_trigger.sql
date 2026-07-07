-- ============================================================================
--  If you already ran 0001_init.sql and only need the profile-creation trigger,
--  run THIS file in the Supabase SQL Editor.
-- ============================================================================

create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, full_name, role, subscription_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'subscriber',
    'inactive'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user ();
