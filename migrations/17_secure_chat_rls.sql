-- Secure Chat System RLS
-- Reverts debug policies and enforces privacy

begin;

-- 1. Drop debug/permissive policies
drop policy if exists "Enable access to all users" on public.messages;
drop policy if exists "Users can see their own messages" on public.messages;
drop policy if exists "Users can send messages" on public.messages;

-- 2. Create Strict Policies

-- Policy: View Messages (Sender OR Receiver)
create policy "Users can view their own messages"
on public.messages
for select
using (
  auth.uid() = sender_id or 
  auth.uid() = receiver_id
);

-- Policy: Send Messages (Sender must be auth user)
create policy "Users can send messages"
on public.messages
for insert
with check (
  auth.uid() = sender_id
);

-- Policy: Update Messages (Receiver can mark as read)
create policy "Receiver can update message status"
on public.messages
for update
using (
  auth.uid() = receiver_id
)
with check (
  auth.uid() = receiver_id
);

commit;
