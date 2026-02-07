-- =============================================
-- Make Role Mandatory (NOT NULL)
-- Ensures every user has either 'customer' or 'provider' role
-- =============================================

-- 1. First, set default role for any null values (to 'customer')
update public.profiles 
set role = 'customer' 
where role is null;

-- 2. Make role NOT NULL and add constraint
alter table public.profiles 
  alter column role set not null,
  alter column role set default 'customer',
  drop constraint if exists profiles_role_check,
  add constraint profiles_role_check 
    check (role in ('customer', 'provider'));

-- =============================================
-- DONE! Role is now mandatory for all users.
-- =============================================
