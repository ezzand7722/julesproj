-- =============================================
-- Auto-Link Bookings to Customers
-- Trigger to automatically set customer_id based on phone number
-- =============================================

create or replace function public.link_booking_to_customer()
returns trigger as $$
declare
  matched_user_id uuid;
begin
  -- Only attempt to link if customer_id is NULL
  if NEW.customer_id is null and NEW.customer_phone is not null then
    
    -- Try to find a profile with this phone number
    select id into matched_user_id
    from public.profiles
    where phone = NEW.customer_phone
    limit 1;

    -- If match found, set the customer_id
    if matched_user_id is not null then
      NEW.customer_id := matched_user_id;
    end if;
    
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

-- Create the trigger
drop trigger if exists on_booking_created_link_customer on public.bookings;

create trigger on_booking_created_link_customer
before insert on public.bookings
for each row
execute function public.link_booking_to_customer();

-- Also run a one-time update for any existing unlinked bookings
update public.bookings b
set customer_id = p.id
from public.profiles p
where b.customer_id is null
  and b.customer_phone = p.phone;
