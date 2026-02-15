-- =============================================
-- Fix legacy provider booking visibility
-- =============================================
-- Problem:
-- Some legacy bookings may store provider_id = auth user id instead of providers.id,
-- which prevents service providers from seeing reservations in dashboard.

begin;

-- 1) Normalize legacy rows where provider_id accidentally equals providers.user_id
update public.bookings b
set provider_id = p.id
from public.providers p
where b.provider_id = p.user_id
  and b.provider_id <> p.id;

-- 2) Ensure providers can read both normalized and still-legacy rows
alter table public.bookings enable row level security;

drop policy if exists "Providers can view their bookings" on public.bookings;
drop policy if exists "Providers can view their assigned bookings" on public.bookings;

create policy "Providers can view their bookings"
  on public.bookings for select
  using (
    provider_id in (select id from public.providers where user_id = auth.uid())
    or provider_id = auth.uid()
  );

commit;
