-- =============================================
-- FIX: Add Unique Constraints for Phone Number
-- =============================================

-- Add unique constraint on phone in profiles table
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_phone_unique UNIQUE (phone);

-- Add unique constraint on email in profiles table (backup, auth.users already enforces this)
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_email_unique UNIQUE (email);

-- =============================================
-- NOTE: Email Confirmation Setting
-- =============================================
-- If you can't login after signup, you need to DISABLE email confirmation in Supabase:
-- 
-- 1. Go to Supabase Dashboard
-- 2. Authentication > Email Templates > Confirm signup
-- 3. Go to Authentication > Providers > Email
-- 4. Turn OFF "Confirm email"
-- 5. Save
--
-- This allows users to login immediately after signup without email verification.
-- =============================================
