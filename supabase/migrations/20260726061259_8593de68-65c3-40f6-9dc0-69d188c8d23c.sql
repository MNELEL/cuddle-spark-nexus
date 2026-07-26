-- Explicit deny-all policy for app_logs. Table is written exclusively via
-- service_role (supabaseAdmin) which bypasses RLS. No app user should read
-- or modify logs directly.
REVOKE ALL ON public.app_logs FROM anon, authenticated;
GRANT ALL ON public.app_logs TO service_role;

CREATE POLICY "Deny all client access to app_logs"
ON public.app_logs
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);