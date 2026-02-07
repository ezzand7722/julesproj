-- =============================================
-- REVIEW SYSTEM ENHANCEMENTS
-- 1. Add 'reviewed' column to bookings
-- 2. Add 'booking_id' column to reviews
-- 3. Create trigger to update provider rating
-- =============================================

-- 1. Add 'reviewed' column to bookings
alter table public.bookings 
add column if not exists reviewed boolean default false;

-- 2. Add 'booking_id' column to reviews (for tracking which booking was reviewed)
alter table public.reviews
add column if not exists booking_id uuid references public.bookings(id);

-- 3. Create a function to update provider rating when a review is added
create or replace function update_provider_rating()
returns trigger as $$
declare
    avg_rating numeric;
    total_reviews integer;
begin
    -- Calculate new average rating for the provider
    select 
        coalesce(avg(rating), 0),
        count(*)
    into avg_rating, total_reviews
    from public.reviews
    where provider_id = NEW.provider_id;
    
    -- Update the provider's rating and review_count
    update public.providers
    set 
        rating = round(avg_rating::numeric, 1),
        review_count = total_reviews
    where id = NEW.provider_id;
    
    return NEW;
end;
$$ language plpgsql security definer;

-- 4. Create trigger to call the function after insert
drop trigger if exists trigger_update_provider_rating on public.reviews;
create trigger trigger_update_provider_rating
after insert on public.reviews
for each row
execute function update_provider_rating();

-- 5. Mark existing completed bookings with reviews as 'reviewed'
-- (Only if booking_id exists in reviews - skip if no reviews have booking_id yet)
-- This is safe to run even if no reviews have booking_id populated
update public.bookings b
set reviewed = true
where exists (
    select 1 from public.reviews r 
    where r.booking_id is not null and r.booking_id = b.id
);

-- 6. Recalculate all provider ratings (one-time fix)
with rating_stats as (
    select 
        provider_id,
        round(avg(rating)::numeric, 1) as avg_rating,
        count(*) as total_reviews
    from public.reviews
    group by provider_id
)
update public.providers p
set 
    rating = rs.avg_rating,
    review_count = rs.total_reviews
from rating_stats rs
where p.id = rs.provider_id;

