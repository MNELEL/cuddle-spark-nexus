create table if not exists public.sent_reminder_alerts (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  sent_at timestamptz not null default now(),
  unique (reminder_id)
);
alter table public.sent_reminder_alerts enable row level security;
grant all on public.sent_reminder_alerts to service_role;