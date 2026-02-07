-- =============================================
-- KHEDMATI - COMPLETE DATABASE SETUP (FIXED)
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. CLEANUP (Optional - be careful, this deletes data!)
-- Drop triggers first
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_profile_created on public.profiles;
drop function if exists public.handle_new_user();
drop function if exists public.handle_new_provider();

-- 2. PROFILES TABLE
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  phone text,
  role text check (role in ('customer', 'provider')),
  created_at timestamptz default now()
);

-- Add unique constraints safely
do $$ 
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_email_unique') then
    alter table public.profiles add constraint profiles_email_unique unique (email);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_phone_unique') then
    alter table public.profiles add constraint profiles_phone_unique unique (phone);
  end if;
end $$;

alter table public.profiles enable row level security;

drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
create policy "Public profiles are viewable by everyone." 
  on public.profiles for select using (true);

drop policy if exists "Users can insert their own profile." on public.profiles;
create policy "Users can insert their own profile." 
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Users can update own profile." on public.profiles;
create policy "Users can update own profile." 
  on public.profiles for update using (auth.uid() = id);

-- 3. PROVIDERS TABLE
create table if not exists public.providers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  name text not null,
  specialty text not null,
  city text not null,
  location text,
  phone text,
  bio text,
  rating numeric(2,1) default 4.0,
  review_count integer default 0,
  is_featured boolean default false,
  is_verified boolean default false,
  created_at timestamptz default now()
);

alter table public.providers enable row level security;

drop policy if exists "Providers are viewable by everyone" on public.providers;
create policy "Providers are viewable by everyone" 
  on public.providers for select using (true);

drop policy if exists "Users can insert their own provider profile" on public.providers;
create policy "Users can insert their own provider profile" 
  on public.providers for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own provider profile" on public.providers;
create policy "Users can update their own provider profile" 
  on public.providers for update using (auth.uid() = user_id);

-- 4. BOOKINGS TABLE
create table if not exists public.bookings (
  id uuid default gen_random_uuid() primary key,
  provider_id uuid references public.providers(id) on delete cascade not null,
  customer_name text not null,
  customer_phone text not null,
  service_date date not null,
  preferred_time text,
  status text default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz default now()
);

alter table public.bookings enable row level security;

drop policy if exists "Providers can view their bookings" on public.bookings;
create policy "Providers can view their bookings" 
  on public.bookings for select using (
    provider_id in (select id from public.providers where user_id = auth.uid())
  );

drop policy if exists "Anyone can create a booking" on public.bookings;
create policy "Anyone can create a booking" 
  on public.bookings for insert with check (true);

drop policy if exists "Providers can update their bookings" on public.bookings;
create policy "Providers can update their bookings" 
  on public.bookings for update using (
    provider_id in (select id from public.providers where user_id = auth.uid())
  );

-- 5. REVIEWS TABLE
create table if not exists public.reviews (
  id uuid default gen_random_uuid() primary key,
  provider_id uuid references public.providers(id) on delete cascade not null,
  customer_name text not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz default now()
);

alter table public.reviews enable row level security;

drop policy if exists "Reviews are viewable by everyone" on public.reviews;
create policy "Reviews are viewable by everyone" 
  on public.reviews for select using (true);

drop policy if exists "Anyone can create a review" on public.reviews;
create policy "Anyone can create a review" 
  on public.reviews for insert with check (true);

-- 6. SERVICES TABLE
create table if not exists public.services (
  id uuid default gen_random_uuid() primary key,
  name_ar text not null,
  name_en text,
  icon text,
  description_ar text,
  provider_count integer default 0,
  created_at timestamptz default now()
);

alter table public.services enable row level security;

drop policy if exists "Services are viewable by everyone" on public.services;
create policy "Services are viewable by everyone" 
  on public.services for select using (true);

-- 7. TRIGGER: Auto-create profile
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'user_type'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 8. TRIGGER: Auto-create provider
create or replace function public.handle_new_provider()
returns trigger as $$
begin
  if new.role = 'provider' then
    insert into public.providers (user_id, name, specialty, city, phone)
    values (
      new.id,
      new.full_name,
      'صيانة عامة',
      'عمّان',
      new.phone
    )
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute procedure public.handle_new_provider();

-- 9. Insert sample services (safely)
insert into public.services (name_ar, name_en, icon, description_ar, provider_count) values
  ('سباكة', 'Plumbing', '🔧', 'خدمات السباكة والصرف الصحي', 45),
  ('كهرباء', 'Electrical', '⚡', 'خدمات الكهرباء والتوصيلات', 38),
  ('تنظيف', 'Cleaning', '🧹', 'خدمات التنظيف المنزلي', 62),
  ('تكييف', 'AC Services', '❄️', 'صيانة وتركيب المكيفات', 28),
  ('دهان', 'Painting', '🎨', 'خدمات الدهان والديكور', 33),
  ('نقل أثاث', 'Moving', '🚛', 'خدمات نقل الأثاث', 25)
on conflict do nothing;
