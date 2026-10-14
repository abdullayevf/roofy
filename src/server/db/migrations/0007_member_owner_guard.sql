-- Task 11 fix 1 (hand-written).
-- F2: the last-owner rule at the database, so two Owners demoting (or removing) each other at the
-- same moment cannot leave a business with no Owner, whether the change comes through the
-- workspace service or Better Auth's /organization/* routes. The advisory lock per workspace makes
-- the "is there another Owner" check and the write one step; under READ COMMITTED the check after
-- the lock sees the other transaction's committed change. A cascade from a removed workspace row
-- is let through; moving a row between workspaces is row-level security's job. SECURITY DEFINER so the count sees every member regardless of row-level security.
CREATE FUNCTION public.member_keeps_an_owner()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF OLD.role <> 'owner' OR (TG_OP = 'UPDATE' AND NEW.role = 'owner') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('roofy_member_owner:' || OLD.workspace_id::text));
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM public.workspace w WHERE w.id = OLD.workspace_id) THEN
    RETURN OLD;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.member m
    WHERE m.workspace_id = OLD.workspace_id AND m.role = 'owner' AND m.id <> OLD.id
  ) THEN
    RAISE EXCEPTION 'roofy_last_owner' USING ERRCODE = '23514', DETAIL = 'Your business needs at least one owner.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.member_keeps_an_owner() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER member_keeps_an_owner
  BEFORE UPDATE OF role OR DELETE ON public.member
  FOR EACH ROW EXECUTE FUNCTION public.member_keeps_an_owner();
--> statement-breakpoint
-- F5 hardening: the profiles function's body is fully schema-qualified, so public leaves its path.
ALTER FUNCTION public.workspace_member_profiles() SET search_path = pg_catalog, pg_temp;
