-- Credit Deduction Trigger (Updated)

-- Drop previous trigger if exists
drop trigger if exists on_booking_created on public.bookings;
drop function if exists public.handle_new_booking();

-- New Function: Handle Booking Confirmation
create or replace function public.handle_booking_confirmation()
returns trigger as $$
declare
    v_provider_user_id uuid;
    v_cost int := 2; -- Default cost per lead
    v_balance int;
begin
    -- Only run when status changes to 'confirmed'
    if new.status = 'confirmed' and old.status != 'confirmed' then
        
        -- Get provider's user_id from providers table
        select user_id into v_provider_user_id
        from public.providers
        where id = new.provider_id;

        if v_provider_user_id is null then
            raise exception 'Provider not found';
        end if;

        -- Check balance
        select credits_balance into v_balance
        from public.profiles
        where id = v_provider_user_id;

        if v_balance < v_cost then
            raise exception 'رصيدك غير كافي لقبول هذا الحجز. يرجى شحن الرصيد.';
        end if;

        -- Log transaction (Ledger trigger will handle profile update)
        insert into public.credits_ledger (provider_id, amount, transaction_type, description)
        values (new.provider_id, -v_cost, 'lead_unlock', 'Accepted booking: ' || new.id);
        
    end if;

    return new;
end;
$$ language plpgsql security definer;

-- Create Trigger on UPDATE
drop trigger if exists on_booking_confirmed on public.bookings;

create trigger on_booking_confirmed
before update on public.bookings
for each row
execute function public.handle_booking_confirmation();
