-- Cleanup Duplicate Services (Fixed UUID Error)
-- Merges duplicate service names into a single entry and cleans up references

begin;

-- 1. Identify duplicates and keep one ID (using cast to text for min function)
create temp table service_mapping on commit drop as
select 
  s.id as bad_id,
  keep.id as good_id
from public.services s
join (
  -- Cast UUID to text to allow min() aggregation, then cast back
  select min(id::text)::uuid as id, name_ar
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

-- 3. Delete the duplicate services
delete from public.services
where id in (select bad_id from service_mapping);

-- 4. Add Unique Constraint to prevent future duplicates (if not exists)
do $$ 
begin
  if not exists (select 1 from pg_constraint where conname = 'services_name_ar_key') then
    alter table public.services add constraint services_name_ar_key unique (name_ar);
  end if;
end $$;

commit;
