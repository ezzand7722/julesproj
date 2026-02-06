-- 1. Create Public Profiles Table
-- This table will store user data visible to the application
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  phone text,
  role text check (role in ('customer', 'provider')),
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
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'user_type'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 4. Activate the Trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
