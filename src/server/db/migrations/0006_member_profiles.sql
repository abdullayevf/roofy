-- Task 11 run 2 (carry note T4(7), hand-written): roofy_app has no grant on the Better Auth "user"
-- table. The workspace service reads member names, emails and two-factor state only through this
-- function, which returns the users who are members of the workspace in app.workspace_id (set
-- transaction-locally by withActor) and nothing else: no workspace set means no rows.
--
-- SECURITY DEFINER so it can read "user" as the migration owner; search_path is pinned (pg_temp
-- last) and every name is schema-qualified. EXECUTE goes to roofy_app only.
CREATE FUNCTION public.workspace_member_profiles()
  RETURNS TABLE (user_id uuid, name text, email text, two_factor_enabled boolean)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT u.id, u.name, u.email, u.two_factor_enabled
  FROM public.member m
  JOIN public."user" u ON u.id = m.user_id
  WHERE m.workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.workspace_member_profiles() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.workspace_member_profiles() TO roofy_app;
