-- =============================================
-- DEBUG SCRIPT: Check Why Bookings are Invisible
-- Run this in SQL Editor and check the results
-- =============================================

-- 1. Check if ANY bookings exist for your user ID
-- Replace 'YOUR_USER_ID_HERE' with your actual ID from the "Authentication" tab
-- But since we are in SQL editor, we can just list recent bookings:

select 
  id, 
  customer_id, 
  customer_name, 
  customer_phone, 
  provider_id, 
  status 
from public.bookings
order by created_at desc
limit 5;

-- 2. Check if RLS is enabled
select tablename, rowsecurity 
from pg_tables 
where tablename = 'bookings';

-- 3. Check active policies
select * from pg_policies where tablename = 'bookings';

-- 4. EMERGENCY OVERRIDE: 
-- If you just want to see them to debug, you can TEMPORARILY disable RLS:
-- alter table public.bookings disable row level security;
-- (Don't leave this disabled in production!)
