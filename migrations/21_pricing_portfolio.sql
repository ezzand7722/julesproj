-- =============================================
-- MIGRATION: 21_pricing_portfolio
-- Description: Adds Credits, Subscriptions, and Portfolio tables
-- =============================================

-- 1. UPDATING PROFILES
-- Add credits balance and verified status
alter table public.profiles 
add column if not exists credits_balance integer default 0,
add column if not exists is_verified boolean default false;

-- 2. SERVICE PACKAGES (Credits Bundles)
-- Providers buy these to get credits
create table if not exists public.service_packages (
    id uuid default gen_random_uuid() primary key,
    name_ar text not null,
    name_en text not null,
    credits_amount integer not null,
    price_jod decimal(10,2) not null,
    is_active boolean default true,
    created_at timestamptz default now()
);

-- Seed basic packages
insert into public.service_packages (name_ar, name_en, credits_amount, price_jod)
values 
('باقة البداية', 'Starter Pack', 10, 5.00),
('باقة التوفير', 'Saver Pack', 25, 10.00),
('باقة المحترفين', 'Pro Pack', 60, 20.00)
on conflict do nothing;

-- 3. SUBSCRIPTION PLANS
-- Monthly plans for providers (Features + Monthly free credits)
create table if not exists public.subscription_plans (
    id uuid default gen_random_uuid() primary key,
    name_key text unique not null, -- 'basic', 'pro'
    name_ar text not null,
    price_monthly_jod decimal(10,2) not null,
    monthly_credits integer default 0,
    features jsonb, -- List of features like {"verified_badge": true, "analytics": true}
    created_at timestamptz default now()
);

insert into public.subscription_plans (name_key, name_ar, price_monthly_jod, monthly_credits, features)
values 
('basic', 'الأساسية (مجاني)', 0.00, 0, '{"verified_badge": false, "top_placement": false}'),
('pro', 'المحترفين', 15.00, 5, '{"verified_badge": true, "top_placement": true, "analytics": true}')
on conflict (name_key) do nothing;

-- 4. PROVIDER SUBSCRIPTIONS
-- Tracks which plan a provider is on
create table if not exists public.provider_subscriptions (
    id uuid default gen_random_uuid() primary key,
    provider_id uuid references public.providers(id) not null,
    plan_id uuid references public.subscription_plans(id) not null,
    status text default 'active' check (status in ('active', 'cancelled', 'expired')),
    start_date timestamptz default now(),
    end_date timestamptz, -- Null for auto-renew or specific date
    auto_renew boolean default true,
    created_at timestamptz default now()
);

-- 5. CREDITS LEDGER
-- Detailed log of every credit transaction (in/out)
create table if not exists public.credits_ledger (
    id uuid default gen_random_uuid() primary key,
    provider_id uuid references public.providers(id) not null,
    amount integer not null, -- Positive for purchase/gift, Negative for usage
    transaction_type text not null check (transaction_type in ('purchase', 'subscription_bonus', 'lead_unlock', 'admin_adjustment')),
    reference_id uuid, -- ID of booking, payment, etc.
    description text,
    created_at timestamptz default now()
);

-- 6. PROVIDER PORTFOLIO
-- Gallery of past work
create table if not exists public.provider_portfolio (
    id uuid default gen_random_uuid() primary key,
    provider_id uuid references public.providers(id) not null,
    media_url text not null,
    media_type text default 'image' check (media_type in ('image', 'video')),
    caption text,
    created_at timestamptz default now()
);

-- SECURITY POLICIES (RLS)

-- A. Portfolio
alter table public.provider_portfolio enable row level security;

-- Public can view all portfolios
create policy "Portfolio items are viewable by everyone" 
on public.provider_portfolio for select 
using (true);

-- Providers can manage their own portfolio
create policy "Providers can insert own portfolio" 
on public.provider_portfolio for insert 
with check (
    provider_id in (select id from public.providers where user_id = auth.uid())
);

create policy "Providers can delete own portfolio" 
on public.provider_portfolio for delete 
using (
    provider_id in (select id from public.providers where user_id = auth.uid())
);

-- B. Credits Ledger
alter table public.credits_ledger enable row level security;

create policy "Providers can view own ledger" 
on public.credits_ledger for select 
using (
    provider_id in (select id from public.providers where user_id = auth.uid())
);

-- C. Subscriptions
alter table public.provider_subscriptions enable row level security;

create policy "Providers can view own subscription" 
on public.provider_subscriptions for select 
using (
    provider_id in (select id from public.providers where user_id = auth.uid())
);

-- TRIGGER: Update Profile Credits Balance on Ledger Insert
create or replace function public.update_credits_balance()
returns trigger as $$
begin
    update public.profiles
    set credits_balance = credits_balance + new.amount
    where id = (select user_id from public.providers where id = new.provider_id);
    return new;
end;
$$ language plpgsql security definer;

create trigger on_credit_transaction
after insert on public.credits_ledger
for each row execute procedure public.update_credits_balance();
