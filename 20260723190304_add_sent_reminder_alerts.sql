-- Dedup table for the scheduled overdue-reminder email digest (see src/server.ts
-- `scheduled` handler + src/lib/reminder-alerts.server.ts). Ensures a given
-- reminder is only ever included in one sent email digest, even if the cron
-- runs more than once for the same day (retries, manual trigger, etc.).
create table public.sent_reminder_alerts (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  sent_at timestamptz not null default now(),
  unique (reminder_id)
);

-- This table is only ever written to / read from the Cloudflare Workers
-- `scheduled` handler via the service-role client (supabaseAdmin), which
-- bypasses RLS entirely. RLS is still enabled with no policies for
-- authenticated/anon roles, matching the project's convention of enabling
-- RLS on every public table by default.
alter table public.sent_reminder_alerts enable row level security;
grant all on public.sent_reminder_alerts to service_role;
