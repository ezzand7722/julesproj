-- Function to add credits (Simulating Payment Success)
create or replace function public.add_credits(amount int, package_name text)
returns json as $$
declare
    v_user_id uuid;
    v_provider_id uuid;
    v_balance int;
begin
    -- Get current user
    v_user_id := auth.uid();
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    -- Get provider ID
    select id into v_provider_id
    from public.providers
    where user_id = v_user_id;

    if v_provider_id is null then
        raise exception 'Provider profile not found';
    end if;

    -- Insert into ledger (Trigger will update profile balance)
    insert into public.credits_ledger (provider_id, amount, transaction_type, description)
    values (v_provider_id, amount, 'deposit', 'Purchased: ' || package_name);

    -- Return new balance
    select credits_balance into v_balance
    from public.profiles
    where id = v_user_id;

    return json_build_object(
        'success', true,
        'new_balance', v_balance,
        'message', 'تم شحن الرصيد بنجاح'
    );
end;
$$ language plpgsql security definer;
