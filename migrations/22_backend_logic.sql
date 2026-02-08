-- Credit Deduction Trigger

create or replace function public.handle_new_booking()
returns trigger as $$
declare
    v_provider_user_id uuid;
    v_cost int := 2; -- Default cost per lead
    v_balance int;
begin
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
        raise exception 'مقدم الخدمة لا يملك رصيد كافي لاستقبال حجوزات جديدة';
    end if;

    -- Deduct credits (Handled by trigger on credits_ledger)
    -- update public.profiles
    -- set credits_balance = credits_balance - v_cost
    -- where id = v_provider_user_id;

    -- Log transaction
    insert into public.credits_ledger (provider_id, amount, transaction_type, description)
    values (new.provider_id, -v_cost, 'usage', 'Order commission: ' || new.id);

    return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists to avoid conflicts
drop trigger if exists on_booking_created on public.bookings;

-- Create Trigger
create trigger on_booking_created
before insert on public.bookings
for each row
execute function public.handle_new_booking();
