drop table if exists public.notifications;

create table public.class_notifications (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  class_name text not null,
  recipient_id uuid not null,
  type text not null default 'class_archived',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.class_notifications enable row level security;

create policy "class_notifications_recipient_select"
  on public.class_notifications for select
  using (recipient_id = auth.uid());

create policy "class_notifications_recipient_update"
  on public.class_notifications for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

revoke all on public.class_notifications from anon;
grant select, update on public.class_notifications to authenticated;
grant all on public.class_notifications to service_role;

create index class_notifications_recipient_unread_idx
  on public.class_notifications (recipient_id, created_at desc)
  where read_at is null;