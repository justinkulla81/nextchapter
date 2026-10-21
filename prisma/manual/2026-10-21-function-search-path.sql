-- CASA prep: Supabase advisor 0011 function_search_path_mutable.
-- Pins an empty search_path on the one flagged function. Every table it reads
-- is schema-qualified (public."..."), and built-ins resolve from pg_catalog,
-- so behavior is unchanged. Non-destructive; re-runnable.
SET lock_timeout = '5s';
ALTER FUNCTION private.employer_outcomes_by_bucket(text, timestamptz) SET search_path = '';
