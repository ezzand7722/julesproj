-- =============================================
-- FIX BOOKING UPDATE RLS POLICY
-- Allow customers to update 'reviewed' field on their own bookings
-- =============================================

-- Drop any existing update policy for customers
drop policy if exists "Customers can update their bookings reviewed status" on public.bookings;

-- Create policy to allow customers to update only the 'reviewed' field on their own bookings
create policy "Customers can update their bookings reviewed status"
  on public.bookings for update
  using (
    customer_id = auth.uid()
    or customer_phone in (
      select phone from public.profiles where id = auth.uid()
    )
  )
  with check (
    customer_id = auth.uid()
    or customer_phone in (
      select phone from public.profiles where id = auth.uid()
    )
  );
