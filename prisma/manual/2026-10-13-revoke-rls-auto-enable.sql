-- public.rls_auto_enable() is a SECURITY DEFINER helper for an event trigger
-- that turns RLS on for new tables. It was callable by the anon and
-- authenticated roles through /rest/v1/rpc/rls_auto_enable. Event triggers do
-- not need EXECUTE granted to API roles to fire. Re-runnable.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, PUBLIC;
