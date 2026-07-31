-- BOZO v2.6.3 public opening access and friend-profile support
-- Run this once in the Supabase SQL Editor.

alter table public.openings enable row level security;

drop policy if exists "public reads published openings" on public.openings;
create policy "public reads published openings"
on public.openings for select
to anon, authenticated
using (status = 'published');

grant select on table public.openings to anon, authenticated;

-- Existing opening policies may call this role helper. Anonymous visitors need
-- EXECUTE permission so the policy can safely evaluate to false for them.
do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'has_any_role'
  loop
    execute format('grant execute on function %s to anon, authenticated', fn.signature);
  end loop;
end $$;

-- Keep the existing friends RPC callable by signed-in users.
do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'my_friends'
  loop
    execute format('grant execute on function %s to authenticated', fn.signature);
  end loop;
end $$;
