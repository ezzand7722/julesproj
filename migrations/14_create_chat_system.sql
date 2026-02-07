-- Create messages table
create table if not exists public.messages (
    id uuid default gen_random_uuid() primary key,
    sender_id uuid references auth.users not null,
    receiver_id uuid references auth.users not null,
    content text not null,
    is_read boolean default false,
    created_at timestamptz default now()
);

-- Enable RLS
alter table public.messages enable row level security;

-- Policies
create policy "Users can see their own messages"
on public.messages for select
using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Users can send messages"
on public.messages for insert
with check (auth.uid() = sender_id);

create policy "Users can update read status of received messages"
on public.messages for update
using (auth.uid() = receiver_id);

-- Create index for performance
create index messages_participants_idx on public.messages(sender_id, receiver_id);
create index messages_created_at_idx on public.messages(created_at desc);
