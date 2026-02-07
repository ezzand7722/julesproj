-- Debug: Relax RLS policies for messages to ensure Realtime works
-- Only apply if you are debugging!

begin;

-- Drop existing strict policies if they exist (to avoid conflicts or shadow)
drop policy if exists "Users can see their own messages" on public.messages;
drop policy if exists "Users can send messages" on public.messages;

-- Create broad policies (CAUTION: FOR DEBUGGING ONLY)
create policy "Enable access to all users"
on public.messages
for all
using (true)
with check (true);

-- Ensure publication existence (redundant but safe)
alter publication supabase_realtime add table public.messages;

commit;
