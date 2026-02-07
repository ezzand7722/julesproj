-- =============================================
-- FORCE FIX: Booking Visibility Policies
-- Run this to ensure customers can SEE their bookings
-- =============================================

-- 1. Reset RLS on bookings table
alter table public.bookings disable row level security;
alter table public.bookings enable row level security;

-- 2. DROP ALL EXISTING POLICIES (Clean Slate)
drop policy if exists "Customers can view their own bookings" on public.bookings;
drop policy if exists "Providers can view their bookings" on public.bookings;
drop policy if exists "Providers can view their assigned bookings" on public.bookings;
drop policy if exists "Anyone can create a booking" on public.bookings;
drop policy if exists "Users can insert their own bookings" on public.bookings;

-- 3. RE-CREATE POLICIES

-- Policy A: Customers can view their own bookings
-- Logic: ID matches OR Phone matches (fallback)
create policy "Customers can view their own bookings"
  on public.bookings for select
  using (
    customer_id = auth.uid()
    or 
    (customer_phone = (select phone from public.profiles where id = auth.uid() limit 1))
  );

-- Policy B: Providers can view bookings assigned to them
create policy "Providers can view their bookings"
  on public.bookings for select
  using (
    provider_id in (select id from public.providers where user_id = auth.uid())
  );

-- Policy C: Anyone can create a booking (for guests and users)
create policy "Anyone can create a booking"
  on public.bookings for insert
  with check (true);

-- Policy D: Customers can update CANCELLED status only (optional, for cancellation)
create policy "Customers can cancel bookings"
  on public.bookings for update
  using (customer_id = auth.uid())
  with check (status = 'cancelled');

-- 4. Verify Trigger (Ensure it exists)
-- This ensures new bookings get linked automatically
create or replace function public.link_booking_to_customer()
returns trigger as $$
declare
  matched_user_id uuid;
begin
  if NEW.customer_id is null and NEW.customer_phone is not null then
    select id into matched_user_id from public.profiles where phone = NEW.customer_phone limit 1;
    if matched_user_id is not null then
      NEW.customer_id := matched_user_id;
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_booking_created_link_customer on public.bookings;
create trigger on_booking_created_link_customer
before insert on public.bookings
for each row execute function public.link_booking_to_customer();
