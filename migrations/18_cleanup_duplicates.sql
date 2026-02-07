-- Cleanup Duplicate Services
-- Merges duplicate service names into a single entry and cleans up references

begin;

-- 1. Identify duplicates and keep the one with the oldest ID (or just one of them)
-- We will use a temporary table to map duplicates to the 'master' service id.

create temp table service_mapping as
select 
  s.id as bad_id,
  keep.id as good_id
from public.services s
join (
  select min(id) as id, name_ar
  from public.services
  group by name_ar
  having count(*) > 1
) keep on s.name_ar = keep.name_ar
where s.id != keep.id;

-- 2. Update references in provider_services (Delete duplicates first to avoid PK conflicts)
-- If a provider has both bad_id and good_id, delete the bad_id row.
delete from public.provider_services ps
using service_mapping sm
where ps.service_id = sm.bad_id
and exists (
  select 1 from public.provider_services ps2 
  where ps2.provider_id = ps.provider_id 
  and ps2.service_id = sm.good_id
);

-- Update remaining references (bad_id -> good_id)
update public.provider_services ps
set service_id = sm.good_id
from service_mapping sm
where ps.service_id = sm.bad_id;

-- 3. Update references in bookings (if service_id is used there, though usually it's just text or provider_id)
-- Checking schema... bookings has service_type (text) usually. 
-- If bookings has service_id FK:
-- update public.bookings b set service_id = sm.good_id from service_mapping sm where b.service_id = sm.bad_id;

-- 4. Delete the duplicate services
delete from public.services
where id in (select bad_id from service_mapping);

-- 5. Add Unique Constraint to prevent future duplicates
alter table public.services 
add constraint services_name_ar_key unique (name_ar);

commit;
