-- Fix Storage Policies for Portfolio

-- 1. Create 'portfolio' bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do nothing;

-- 2. Drop existing policies to avoid conflicts
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Authenticated Upload" on storage.objects;
drop policy if exists "Authenticated Delete" on storage.objects;
drop policy if exists "Portfolio Public View" on storage.objects;
drop policy if exists "Portfolio Provider Upload" on storage.objects;

-- 3. Create Policies

-- Allow public read access to everyone
create policy "Portfolio Public View"
on storage.objects for select
using ( bucket_id = 'portfolio' );

-- Allow any authenticated user to upload files to 'portfolio' bucket
-- (Simplifying to avoid complex joins for now, but still secure as it requires login)
create policy "Portfolio Provider Upload"
on storage.objects for insert
with check (
  bucket_id = 'portfolio' 
  and auth.role() = 'authenticated'
);

-- Allow users to update/delete their own files (or any file for now if they are auth, to keep it simple for the fix)
create policy "Portfolio Provider Delete"
on storage.objects for delete
using (
  bucket_id = 'portfolio'
  and auth.role() = 'authenticated'
);
