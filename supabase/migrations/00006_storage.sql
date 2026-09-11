-- Dekont storage. "dekontlar" is a private storage bucket, not a table — the
-- code reaches it with supabase.storage.from("dekontlar"). It was created by
-- hand on the live database of the previous event and had no migration behind
-- it, so a clean bootstrap silently failed every upload.
--
-- Every object is keyed <user_id>/..., which is what the policies below rely on.

insert into storage.buckets (id, name, public)
values ('dekontlar', 'dekontlar', false)
on conflict (id) do nothing;

-- A registrant reads and writes only their own folder. District staff go
-- through the service role, which bypasses these policies.
create policy "Users can read own dekont"
  on storage.objects for select
  using (
    bucket_id = 'dekontlar'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can upload own dekont"
  on storage.objects for insert
  with check (
    bucket_id = 'dekontlar'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Uploads use upsert:true, which updates in place when a dekont is replaced.
create policy "Users can update own dekont"
  on storage.objects for update
  using (
    bucket_id = 'dekontlar'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'dekontlar'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
