-- KHEDMATI DATABASE SETUP
-- Run this ONCE in Supabase SQL Editor

-- 1. Create Public Profiles Table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  phone text,
  role text default 'customer' check (role in ('customer', 'provider')),
  created_at timestamptz default now()
);

-- 2. Enable Security (RLS) for Profiles
alter table public.profiles enable row level security;
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
drop policy if exists "Users can insert their own profile." on public.profiles;
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "Users can update own profile." on public.profiles;
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

-- 3. Create Trigger Function (Auto-saves user on signup)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'user_type', 'customer')
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 4. Activate the Trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. Services Table
create table if not exists public.services (
  id uuid default gen_random_uuid() primary key,
  name_ar text not null,
  name_en text,
  description_ar text,
  icon text,
  provider_count int default 0,
  created_at timestamptz default now()
);
alter table public.services enable row level security;
drop policy if exists "Services are viewable by everyone." on public.services;
create policy "Services are viewable by everyone." on public.services for select using (true);

-- 6. Providers Table
create table if not exists public.providers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  specialty text,
  city text,
  location text,
  phone text,
  rating numeric(2,1) default 0.0,
  review_count int default 0,
  is_featured boolean default false,
  is_verified boolean default false,
  created_at timestamptz default now()
);
alter table public.providers enable row level security;
drop policy if exists "Providers are viewable by everyone." on public.providers;
create policy "Providers are viewable by everyone." on public.providers for select using (true);

-- 7. Bookings Table
create table if not exists public.bookings (
  id uuid default gen_random_uuid() primary key,
  provider_id uuid references public.providers(id) on delete cascade,
  customer_name text not null,
  customer_phone text,
  service_date date,
  preferred_time text,
  notes text,
  status text default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz default now()
);
alter table public.bookings enable row level security;
drop policy if exists "Bookings are viewable by everyone." on public.bookings;
create policy "Bookings are viewable by everyone." on public.bookings for select using (true);
drop policy if exists "Anyone can insert bookings." on public.bookings;
create policy "Anyone can insert bookings." on public.bookings for insert with check (true);

-- 8. Reviews Table
create table if not exists public.reviews (
  id uuid default gen_random_uuid() primary key,
  provider_id uuid references public.providers(id) on delete cascade,
  customer_name text not null,
  rating int check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz default now()
);
alter table public.reviews enable row level security;
drop policy if exists "Reviews are viewable by everyone." on public.reviews;
create policy "Reviews are viewable by everyone." on public.reviews for select using (true);
drop policy if exists "Anyone can insert reviews." on public.reviews;
create policy "Anyone can insert reviews." on public.reviews for insert with check (true);

-- DONE! All tables created successfully.
