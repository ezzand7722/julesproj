-- =============================================
-- MIGRATION: 26_service_offerings
-- Description: Adds service_offerings table for provider pricing transparency
-- Providers can list specific services with prices (fixed, hourly, starting_at)
-- =============================================

-- 1. SERVICE OFFERINGS TABLE
-- Each provider can list their specific services with pricing
create table if not exists public.service_offerings (
    id uuid default gen_random_uuid() primary key,
    provider_id uuid references public.providers(id) on delete cascade not null,
    title text not null,                    -- e.g. "تنظيف مكيف سبليت"
    description text,                       -- details about what's included
    price decimal(10,2) not null,           -- price in JOD
    price_type text not null default 'fixed' 
        check (price_type in ('fixed', 'hourly', 'starting_at')),
    estimated_duration text,                -- e.g. "ساعة واحدة", "2-3 ساعات"
    is_active boolean default true,
    sort_order integer default 0,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 2. INDEX for fast lookups
create index if not exists idx_service_offerings_provider 
    on public.service_offerings(provider_id) 
    where is_active = true;

-- 3. ROW LEVEL SECURITY
alter table public.service_offerings enable row level security;

-- Everyone can view active offerings
create policy "Service offerings are viewable by everyone"
on public.service_offerings for select
using (is_active = true);

-- Providers can manage their own offerings
create policy "Providers can insert own offerings"
on public.service_offerings for insert
with check (
    provider_id in (select id from public.providers where user_id = auth.uid())
);

create policy "Providers can update own offerings"
on public.service_offerings for update
using (
    provider_id in (select id from public.providers where user_id = auth.uid())
);

create policy "Providers can delete own offerings"
on public.service_offerings for delete
using (
    provider_id in (select id from public.providers where user_id = auth.uid())
);

-- 4. AUTO-UPDATE updated_at TRIGGER
create or replace function public.update_service_offering_timestamp()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger set_service_offering_timestamp
    before update on public.service_offerings
    for each row
    execute procedure public.update_service_offering_timestamp();
