-- Tombstone / no-op migration (restored for DB↔repo history consistency).
--
-- The original 20260808225907 migration created public.notifications (a generic
-- notifications table). It was reverted the next day: 20260809092949 replaced it
-- with the focused public.class_notifications table and dropped it.
--
-- This version is recorded in supabase_migrations.schema_migrations, so the file
-- must exist in the repo, but it must NOT recreate the table. The statement below
-- is intentionally a no-op that also asserts the cleanup is still in place.
do $$
begin
  if to_regclass('public.notifications') is not null then
    raise exception 'public.notifications should not exist; the generic notifications table was intentionally removed in favour of public.class_notifications';
  end if;
end $$;
