-- =============================================
-- MIGRATION 1: Multi-Service Support (FIXED)
-- Allows providers to offer multiple services
-- =============================================

-- 1. Create provider_services junction table
create table if not exists public.provider_services (
  provider_id uuid references public.providers(id) on delete cascade not null,
  service_id uuid references public.services(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (provider_id, service_id)
);

-- Enable RLS
alter table public.provider_services enable row level security;

-- RLS Policies
drop policy if exists "Provider services are viewable by everyone" on public.provider_services;
create policy "Provider services are viewable by everyone" 
  on public.provider_services for select using (true);

drop policy if exists "Providers can manage their own services" on public.provider_services;
create policy "Providers can manage their own services" 
  on public.provider_services for all using (
    provider_id in (select id from public.providers where user_id = auth.uid())
  );

-- 2. Add verification fields to providers table
alter table public.providers 
  add column if not exists verification_status text default 'pending' 
    check (verification_status in ('pending', 'approved', 'rejected')),
  add column if not exists verification_documents jsonb default '{}';

-- Update is_verified to sync with verification_status
update public.providers 
  set verification_status = 'approved' 
  where is_verified = true;

-- 3. Create function to calculate real provider counts
create or replace function get_service_provider_count(service_uuid uuid)
returns bigint as $$
  select count(distinct provider_id)
  from public.provider_services
  where service_id = service_uuid;
$$ language sql stable;

-- 4. FIXED: Ensure default service exists first
insert into public.services (name_ar, icon, description_ar)
values ('خدمات عامة', '🔧', 'خدمات صيانة وإصلاح عامة')
on conflict do nothing;

-- 5. Migrate existing providers to use multi-service
-- First, try to match by specialty name
insert into public.provider_services (provider_id, service_id)
select 
  p.id,
  s.id
from public.providers p
join public.services s on lower(s.name_ar) = lower(p.specialty)
on conflict do nothing;

-- For providers without matching service, add to default service
insert into public.provider_services (provider_id, service_id)
select 
  p.id,
  s.id
from public.providers p
cross join (
  select id from public.services 
  where name_ar in ('خدمات عامة', 'صيانة عامة') 
  limit 1
) s
where not exists (
  select 1 from public.provider_services ps where ps.provider_id = p.id
)
on conflict do nothing;

-- =============================================
-- DONE! Providers can now offer multiple services.
-- =============================================
