-- =============================================
-- MIGRATION: 20_add_payments_notifications_tracking
-- Description: Adds tables for Payments, Notifications, and Real-time Tracking
-- =============================================

-- 1. PAYMENTS TABLE
-- Stores transaction details for ClickPay/JoPayment integration
create table if not exists public.payments (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid references public.bookings(id) not null,
  user_id uuid references auth.users(id) not null,
  amount decimal(10,2) not null,
  currency text default 'JOD',
  provider text not null check (provider in ('clickpay', 'jopayment', 'cash', 'card')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  transaction_ref text, -- External ID from gateway
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS for Payments
alter table public.payments enable row level security;

create policy "Users can view their own payments"
  on public.payments for select
  using (auth.uid() = user_id);

create policy "Admins can view all payments"
  on public.payments for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin' -- Assuming admin role check logic
    )
  );

-- 2. NOTIFICATIONS TABLE
-- Centralized system for user alerts
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  title text not null,
  message text not null,
  type text default 'info' check (type in ('info', 'booking_update', 'chat', 'promo', 'security')),
  is_read boolean default false,
  related_entity_id uuid, -- Can be booking_id, message_id, etc.
  created_at timestamptz default now()
);

-- RLS for Notifications
alter table public.notifications enable row level security;

create policy "Users can view their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update their own notifications (mark read)"
  on public.notifications for update
  using (auth.uid() = user_id);

-- 3. PROVIDER LOCATIONS (TRACKING)
-- Real-time location storage for "Uber-like" tracking
-- Note: Uses simple lat/lng to avoid PostGIS dependency if not enabled.
-- If PostGIS is enabled, use: location geography(POINT)
create table if not exists public.provider_locations (
  provider_id uuid references public.providers(id) on delete cascade primary key,
  latitude double precision not null,
  longitude double precision not null,
  heading double precision, -- Direction in degrees (0-360)
  is_online boolean default true,
  last_updated timestamptz default now()
);

-- RLS for Provider Locations
alter table public.provider_locations enable row level security;

-- Everyone can read locations (or restrict to customers with active booking)
-- For MVP: Allow public read to enable "Find Providers Near Me" features easily
create policy "Locations are public"
  on public.provider_locations for select
  using (true);

-- Providers can only update their own location
create policy "Providers can update own location"
  on public.provider_locations for update
  using (
    provider_id in (
        select id from public.providers where user_id = auth.uid()
    )
  );

create policy "Providers can insert own location"
  on public.provider_locations for insert
  with check (
    provider_id in (
        select id from public.providers where user_id = auth.uid()
    )
  );

-- 4. INDEXES
create index if not exists payments_booking_id_idx on public.payments(booking_id);
create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_is_read_idx on public.notifications(is_read);
