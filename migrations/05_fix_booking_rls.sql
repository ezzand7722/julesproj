-- =============================================
-- Fix Booking Visibility & RLS
-- Ensures customers can see their own bookings
-- =============================================

-- 1. Enable RLS on bookings if not already enabled
alter table public.bookings enable row level security;

-- 2. Add SELECT policy for customers
-- Allows users to see bookings where customer_id matches their ID
-- OR where phone/name matches (for legacy support)
drop policy if exists "Customers can view their own bookings" on public.bookings;

create policy "Customers can view their own bookings"
  on public.bookings for select
  using (
    customer_id = auth.uid()
    or 
    (customer_id is null and customer_phone in (select phone from public.profiles where id = auth.uid()))
  );

-- 3. Also allow Providers to view bookings for them
drop policy if exists "Providers can view their assigned bookings" on public.bookings;

create policy "Providers can view their assigned bookings"
  on public.bookings for select
  using (
    provider_id in (select id from public.providers where user_id = auth.uid())
  );

-- =============================================
-- DONE! Customers and Providers can now see their bookings
-- =============================================
