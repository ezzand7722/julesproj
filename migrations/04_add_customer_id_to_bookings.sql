-- =============================================
-- Add customer_id to bookings table
-- Links bookings directly to customer user accounts
-- =============================================

-- Add customer_id column
alter table public.bookings 
  add column if not exists customer_id uuid references auth.users(id);

-- Create index for faster queries
create index if not exists idx_bookings_customer_id 
  on public.bookings(customer_id);

-- Migrate existing bookings: try to match by email
update public.bookings b
set customer_id = p.id
from public.profiles p
where b.customer_id is null
  and (
    lower(b.customer_email) = lower(p.email)
    or lower(b.customer_name) = lower(p.full_name)
  );

-- =============================================
-- DONE! Bookings now linked to customer accounts
-- =============================================
