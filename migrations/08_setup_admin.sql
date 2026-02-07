-- =============================================
-- ADMIN SETUP & CLEANUP MIGRATION
-- 1. Add is_admin column
-- 2. Add Admin RLS Policies
-- 3. Cleanup unused data
-- =============================================

-- 1. Add Admin Column
alter table public.profiles 
add column if not exists is_admin boolean default false;

-- 2. Grant Admin Permissions (RLS)
-- Allow admins to see/edit everything in key tables

create policy "Admins can view all profiles"
  on public.profiles for select
  using ( is_admin = true );

create policy "Admins can view all bookings"
  on public.bookings for select
  using ( (select is_admin from public.profiles where id = auth.uid()) = true );

create policy "Admins can delete bookings"
  on public.bookings for delete
  using ( (select is_admin from public.profiles where id = auth.uid()) = true );

-- 3. MAKE YOU AN ADMIN
-- This command sets the LAST created user as admin automatically
-- Use this as a quick hack for development
update public.profiles 
set is_admin = true 
where id in (
  select id from public.profiles 
  order by created_at desc 
  limit 1
);

-- OR if you know your specific email, uncomment this:
-- update public.profiles set is_admin = true where email = 'your@email.com';
