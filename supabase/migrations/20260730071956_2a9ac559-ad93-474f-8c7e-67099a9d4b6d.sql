ALTER TABLE public.sent_reminder_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all access to sent_reminder_alerts"
ON public.sent_reminder_alerts
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Service role can manage sent_reminder_alerts"
ON public.sent_reminder_alerts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);