-- 1. Create the public bucket 'trainer-documents' if it doesn't exist
insert into storage.buckets (id, name, public)
values ('trainer-documents', 'trainer-documents', true)
on conflict (id) do nothing;

-- 2. Create Row Level Security (RLS) policies for the 'trainer-documents' bucket on storage.objects

-- Allow public read access to all files inside 'trainer-documents'
create policy "Allow public select access for trainer-documents"
on storage.objects for select
using (bucket_id = 'trainer-documents');

-- Allow public insert access for uploading new documents to 'trainer-documents'
create policy "Allow public insert access for trainer-documents"
on storage.objects for insert
with check (bucket_id = 'trainer-documents');

-- Allow public update access for updating/replacing documents in 'trainer-documents'
create policy "Allow public update access for trainer-documents"
on storage.objects for update
with check (bucket_id = 'trainer-documents');
