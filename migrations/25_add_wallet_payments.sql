-- =============================================
-- MIGRATION: 25_add_wallet_payments
-- Description: Adds support for CliQ, uWallet, Orange Money, and credit cards for top-ups
-- =============================================

-- 1. Update payments table to support wallet top-ups (not just bookings)
alter table public.payments 
  alter column booking_id drop not null,
  add column if not exists payment_purpose text default 'booking' check (payment_purpose in ('booking', 'topup'));

-- 2. Update payment provider options to include digital wallets
alter table public.payments 
  drop constraint if exists payments_provider_check;

alter table public.payments 
  add constraint payments_provider_check 
  check (provider in ('clickpay', 'jopayment', 'cash', 'card', 'cliq', 'uwallet', 'orange_money', 'credit_card'));

-- 3. Create wallet_transactions table for tracking wallet-specific data
create table if not exists public.wallet_transactions (
  id uuid default gen_random_uuid() primary key,
  payment_id uuid references public.payments(id) not null,
  wallet_type text not null check (wallet_type in ('cliq', 'uwallet', 'orange_money')),
  wallet_phone text, -- For CliQ/Orange Money phone numbers
  wallet_account text, -- For uWallet account IDs
  status text default 'pending' check (status in ('pending', 'completed', 'failed', 'refunded')),
  gateway_response jsonb, -- Store response from payment gateway
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS for wallet_transactions
alter table public.wallet_transactions enable row level security;

create policy "Users can view their own wallet transactions"
  on public.wallet_transactions for select
  using (
    exists (
      select 1 from public.payments p
      where p.id = wallet_transactions.payment_id
      and p.user_id = auth.uid()
    )
  );

-- 4. Create function to process top-up payment
create or replace function public.create_topup_payment(
  p_amount decimal,
  p_provider text,
  p_package_name text,
  p_wallet_details jsonb default null
)
returns json as $$
declare
  v_user_id uuid;
  v_provider_id uuid;
  v_payment_id uuid;
  v_wallet_tx_id uuid;
begin
  -- Get current user
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Get provider profile ID
  select id into v_provider_id
  from public.providers
  where user_id = v_user_id;

  if v_provider_id is null then
    raise exception 'Provider profile not found';
  end if;

  -- Create payment record
  insert into public.payments (
    user_id,
    amount,
    provider,
    status,
    payment_purpose,
    currency
  )
  values (
    v_user_id,
    p_amount,
    p_provider,
    'pending',
    'topup',
    'JOD'
  )
  returning id into v_payment_id;

  -- If wallet payment, create wallet transaction
  if p_provider in ('cliq', 'uwallet', 'orange_money') and p_wallet_details is not null then
    insert into public.wallet_transactions (
      payment_id,
      wallet_type,
      wallet_phone,
      wallet_account,
      gateway_response
    )
    values (
      v_payment_id,
      p_provider,
      p_wallet_details->>'phone',
      p_wallet_details->>'account',
      p_wallet_details
    )
    returning id into v_wallet_tx_id;
  end if;

  return json_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'wallet_tx_id', v_wallet_tx_id,
    'message', 'Payment initiated. Awaiting confirmation.'
  );
end;
$$ language plpgsql security definer;

-- 5. Create function to confirm payment and add credits
create or replace function public.confirm_topup_payment(
  p_payment_id uuid,
  p_transaction_ref text,
  p_credits_amount int,
  p_package_name text
)
returns json as $$
declare
  v_user_id uuid;
  v_provider_id uuid;
  v_balance int;
  v_payment_exists boolean;
begin
  -- Verify payment exists and belongs to user
  select 
    p.user_id,
    exists(select 1)
  into 
    v_user_id,
    v_payment_exists
  from public.payments p
  where p.id = p_payment_id
    and p.user_id = auth.uid()
    and p.status = 'pending';

  if not v_payment_exists then
    raise exception 'Payment not found or already processed';
  end if;

  -- Update payment status
  update public.payments
  set 
    status = 'paid',
    transaction_ref = p_transaction_ref,
    updated_at = now()
  where id = p_payment_id;

  -- Update wallet transaction if exists
  update public.wallet_transactions
  set 
    status = 'completed',
    updated_at = now()
  where payment_id = p_payment_id;

  -- Get provider ID
  select id into v_provider_id
  from public.providers
  where user_id = v_user_id;

  -- Add credits to ledger (trigger will update balance)
  insert into public.credits_ledger (
    provider_id,
    amount,
    transaction_type,
    reference_id,
    description
  )
  values (
    v_provider_id,
    p_credits_amount,
    'purchase',
    p_payment_id,
    'Top-up: ' || p_package_name || ' via ' || (select provider from public.payments where id = p_payment_id)
  );

  -- Get new balance
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

-- 6. Update the old add_credits function to use transaction_type 'purchase' instead of 'deposit'
drop function if exists public.add_credits(int, text);

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
    values (v_provider_id, amount, 'purchase', 'Purchased: ' || package_name);

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

-- 7. Fix credits_ledger constraint to include 'purchase' and 'deposit'
alter table public.credits_ledger 
  drop constraint if exists credits_ledger_transaction_type_check;

alter table public.credits_ledger 
  add constraint credits_ledger_transaction_type_check 
  check (transaction_type in ('purchase', 'deposit', 'subscription_bonus', 'lead_unlock', 'admin_adjustment'));
