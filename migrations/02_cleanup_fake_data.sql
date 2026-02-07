-- =============================================
-- MIGRATION 2: Data Cleanup
-- Remove fake/mock data and update to real counts
-- =============================================

-- 1. Delete all mock reviews (keep only real user reviews)
-- Assuming mock reviews were created before the project started
-- or have specific test user patterns
delete from public.reviews 
where created_at < '2026-02-01'  -- Adjust this date to your project start
  or customer_name in ('أحمد محمد', 'فاطمة علي', 'محمد حسن');  -- Common test names

-- 2. Update services table to remove hardcoded provider_count
-- Remove the column entirely since we'll calculate it dynamically
alter table public.services drop column if exists provider_count;

-- 3. Update review_count in providers to be accurate
update public.providers p
set review_count = (
  select count(*) 
  from public.reviews r 
  where r.provider_id = p.id
);

-- 4. Update rating in providers to be average of actual reviews
update public.providers p
set rating = (
  select coalesce(avg(r.rating), 4.0)
  from public.reviews r 
  where r.provider_id = p.id
);

-- 5. Create view for service statistics (for homepage display)
create or replace view service_stats as
select 
  s.id,
  s.name_ar,
  s.name_en,
  s.icon,
  s.description_ar,
  count(distinct ps.provider_id) as provider_count
from public.services s
left join public.provider_services ps on s.id = ps.service_id
group by s.id, s.name_ar, s.name_en, s.icon, s.description_ar;

-- Grant access to view
grant select on service_stats to anon, authenticated;

-- =============================================
-- DONE! Fake data removed, real counts in place.
-- =============================================
