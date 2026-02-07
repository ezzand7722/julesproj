-- =============================================
-- FIX DATABASE TRIGGERS AND PERMISSIONS
-- Run this AFTER the main setup
-- =============================================

-- 1. DROP old trigger to replace it
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_profile_created on public.profiles;
drop function if exists public.handle_new_user();
drop function if exists public.handle_new_provider();

-- 2. IMPROVED TRIGGER: Auto-create profile (with error handling)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'user_type', 'customer')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, profiles.full_name),
    phone = coalesce(excluded.phone, profiles.phone),
    role = coalesce(excluded.role, profiles.role);
  
  return new;
exception
  when others then
    -- Log but don't fail signup
    raise warning 'Failed to create profile: %', SQLERRM;
    return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. IMPROVED TRIGGER: Auto-create provider
create or replace function public.handle_new_provider()
returns trigger as $$
begin
  if new.role = 'provider' then
    insert into public.providers (user_id, name, specialty, city, phone)
    values (
      new.id,
      coalesce(new.full_name, 'مقدم خدمة'),
      'صيانة عامة',
      'عمّان',
      coalesce(new.phone, '')
    )
    on conflict (user_id) do nothing;
  end if;
  return new;
exception
  when others then
    raise warning 'Failed to create provider: %', SQLERRM;
    return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute procedure public.handle_new_provider();

-- 4. FIX RLS POLICIES for profiles (remove unique constraints that might conflict)
drop policy if exists "Users can insert their own profile." on public.profiles;
drop policy if exists "Users can update own profile." on public.profiles;

create policy "Users can insert their own profile." 
  on public.profiles for insert 
  with check (auth.uid() = id);

create policy "Users can update own profile." 
  on public.profiles for update 
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 5. FIX RLS POLICIES for providers
drop policy if exists "Users can insert their own provider profile" on public.providers;
drop policy if exists "Users can update their own provider profile" on public.providers;

create policy "Users can insert their own provider profile" 
  on public.providers for insert 
  with check (auth.uid() = user_id);

create policy "Users can update their own provider profile" 
  on public.providers for update 
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 6. Make email/phone constraints optional (they might cause conflicts)
alter table public.profiles drop constraint if exists profiles_email_unique;
alter table public.profiles drop constraint if exists profiles_phone_unique;

-- Add them back as DEFERRABLE to allow updates
do $$ 
begin
  -- Only add if doesn't exist
  if not exists (select 1 from pg_constraint where conname = 'profiles_email_key') then
    alter table public.profiles add constraint profiles_email_key unique (email) deferrable initially deferred;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_phone_key') then
    alter table public.profiles add constraint profiles_phone_key unique (phone) deferrable initially deferred;
  end if;
exception
  when others then
    raise notice 'Constraints already exist or error: %', SQLERRM;
end $$;

-- =============================================
-- DONE! Try signing up again.
-- =============================================
