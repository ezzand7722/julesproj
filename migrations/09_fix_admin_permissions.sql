-- =============================================
-- FIXED ADMIN SETUP (TARGETED)
-- Run this to make Ezz Kilani an Admin
-- =============================================

-- 1. Ensure the column exists
alter table public.profiles 
add column if not exists is_admin boolean default false;

-- 2. CREATE ADMIN POLICIES
-- Drop old ones first to avoid conflicts
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Admins can view all bookings" on public.bookings;
drop policy if exists "Admins can delete bookings" on public.bookings;

-- Policy: Admin can view all profiles
create policy "Admins can view all profiles"
  on public.profiles for select
  using ( is_admin = true );

-- Policy: Admin can view all bookings
create policy "Admins can view all bookings"
  on public.bookings for select
  using ( 
    (select is_admin from public.profiles where id = auth.uid()) = true 
  );

-- Policy: Admin can delete bookings
create policy "Admins can delete bookings"
  on public.bookings for delete
  using ( 
    (select is_admin from public.profiles where id = auth.uid()) = true 
  );

-- 3. PROMOTE SPECIFIC USER
-- Target: Ezz Kilani (d65c8055-acb3-415b-b6d4-b149cf3d18d6)
update public.profiles 
set is_admin = true 
where id = 'd65c8055-acb3-415b-b6d4-b149cf3d18d6';

-- OPTIONAL: Verify the promotion
-- select * from public.profiles where is_admin = true;
