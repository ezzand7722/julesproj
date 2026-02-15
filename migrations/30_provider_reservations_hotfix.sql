-- =============================================
-- HOTFIX: Provider reservations not visible
-- Run this once in Supabase SQL Editor
-- =============================================

begin;

-- 1) Ensure bookings RLS is enabled
alter table public.bookings enable row level security;

-- 2) Repair legacy rows where provider_id was stored as providers.user_id
update public.bookings b
set provider_id = p.id
from public.providers p
where b.provider_id = p.user_id
  and b.provider_id <> p.id;

-- 3) Recreate provider select policy (covers normalized + legacy rows)
drop policy if exists "Providers can view their bookings" on public.bookings;
drop policy if exists "Providers can view their assigned bookings" on public.bookings;

create policy "Providers can view their bookings"
  on public.bookings
  for select
  using (
    provider_id in (select id from public.providers where user_id = auth.uid())
    or provider_id = auth.uid()
  );

commit;

-- =============================================
-- QUICK VERIFICATION QUERIES (optional)
-- =============================================
-- 1) Count bookings linked to provider table IDs:
-- select count(*) from public.bookings b
-- where b.provider_id in (select id from public.providers);
--
-- 2) Count suspicious rows still using auth user IDs:
-- select count(*) from public.bookings b
-- where b.provider_id in (select user_id from public.providers);
