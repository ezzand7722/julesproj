-- =============================================
-- ADD MISSING COLUMNS TO PROVIDERS TABLE
-- Run this to add bio and location columns
-- =============================================

-- Add bio column if it doesn't exist
do $$ 
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'providers' 
    and column_name = 'bio'
  ) then
    alter table public.providers add column bio text;
    raise notice 'Added bio column to providers table';
  else
    raise notice 'bio column already exists';
  end if;
end $$;

-- Add location column if it doesn't exist
do $$ 
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'providers' 
    and column_name = 'location'
  ) then
    alter table public.providers add column location text;
    raise notice 'Added location column to providers table';
  else
    raise notice 'location column already exists';
  end if;
end $$;

-- Refresh the schema cache (PostgREST)
notify pgrst, 'reload schema';

-- =============================================
-- DONE! Try saving your profile again.
-- =============================================
