-- 1. Create Public Profiles Table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  phone text,
  role text default 'customer' check (role in ('customer', 'provider')),
  created_at timestamptz default now()
);

-- 2. Enable Security (RLS)
alter table public.profiles enable row level security;

-- Allow everyone to read profiles (needed for checking user role on login)
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
create policy "Public profiles are viewable by everyone." 
  on public.profiles for select 
  using (true);

-- Allow users to insert their own profile (for signup)
drop policy if exists "Users can insert their own profile." on public.profiles;
create policy "Users can insert their own profile." 
  on public.profiles for insert 
  with check (auth.uid() = id);

-- Allow users to update their own profile
drop policy if exists "Users can update own profile." on public.profiles;
create policy "Users can update own profile." 
  on public.profiles for update 
  using (auth.uid() = id);

-- 3. Create Trigger Function
-- This automatically doubles the user info into the profiles table when they sign up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name', -- Corrected key for Google Auth
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

-- 5. Additional Tables (Services, Providers, Bookings, Reviews)
create table if not exists public.services (
  id uuid default gen_random_uuid() primary key,
  name_ar text not null,
  name_en text,
  description_ar text,
  icon text,
  provider_count int default 0,
  created_at timestamptz default now()
);

create table if not exists public.providers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
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

alter table public.services enable row level security;
create policy "Services are viewable by everyone." on public.services for select using (true);

alter table public.providers enable row level security;
create policy "Providers are viewable by everyone." on public.providers for select using (true);
