-- Enable Realtime for messages table
-- This is often required for Supabase to broadcast changes

begin;
  -- Check if publication exists (standard in Supabase)
  -- Add messages table to the publication
  alter publication supabase_realtime add table public.messages;
commit;
