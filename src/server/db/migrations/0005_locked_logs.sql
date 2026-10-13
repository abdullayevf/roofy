-- Task 6: locked logs (hand-written; plan 04-db-auth Task 6). A work_log with pay_run_id set is in
-- an approved pay run: it cannot be updated, soft-deleted, deleted or unlocked, and no log can be
-- locked, unless app.locked_write is 'on'. Only withLockedWrite in src/server/db/locked.ts sets it
-- (transaction-local), for the Phase 7 approve and reopen service. Inserts are not guarded.
--
-- Deleting a workspace cascades into work_log; that must not be blocked by its locked logs. A delete
-- is let through only when both hold:
--   * pg_trigger_depth() > 1: we are inside another trigger, here the FK cascade's RI trigger on
--     workspace. A direct DELETE from any role runs at depth 1 and is always checked.
--   * the log's workspace row no longer exists. In the cascade the RI query runs as the table
--     owner with forced RLS off, so it sees the real catalogue state: the workspace is gone. Any
--     other caller that can see the log under RLS also sees its workspace (both policies match the
--     same app.workspace_id), so the check fails and the delete is refused.
-- No other FK touches a locked row: every other work_log FK (crew member, project, stage,
-- progress entry, pay run, the adjusts_log self-FK, entered_by) is ON DELETE NO ACTION, so deleting
-- that parent is refused while logs point at it.
--
-- SECURITY INVOKER: the guard writes nothing and reads only workspace, so it needs no owner rights;
-- running as the caller keeps its workspace check under the caller's own RLS. search_path is
-- pinned (pg_temp last). Firing a trigger needs no EXECUTE, so none is granted.
CREATE FUNCTION public.locked_log_guard() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF current_setting('app.locked_write', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.pay_run_id IS NULL THEN
      RETURN OLD;
    END IF;
    IF pg_trigger_depth() > 1 AND NOT EXISTS (SELECT 1 FROM public.workspace w WHERE w.id = OLD.workspace_id) THEN
      RETURN OLD;
    END IF;
  ELSIF OLD.pay_run_id IS NULL AND NEW.pay_run_id IS NULL THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION USING ERRCODE = 'RF001', MESSAGE = 'This log is in an approved pay run';
END
$$;
ALTER FUNCTION public.locked_log_guard() OWNER TO roofy;
REVOKE ALL ON FUNCTION public.locked_log_guard() FROM PUBLIC;

CREATE TRIGGER "work_log_locked" BEFORE UPDATE OR DELETE ON "work_log" FOR EACH ROW EXECUTE FUNCTION public.locked_log_guard();
