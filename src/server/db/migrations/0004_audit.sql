-- Task 5: the audit trail (hand-written; plan 04-db-auth Task 5). One trigger function writes one
-- audit_event row for the row that fired it: before/after as JSON (null on the missing side),
-- the row's workspace (its own id for workspace), and app.user_id, which withActor sets LOCAL
-- (null when unset, as in owner-pool seeds and migrations).
--
-- SECURITY DEFINER, owned by roofy, because roofy_app may only read audit_event. It writes
-- nothing but that one row: the values come from NEW/OLD and TG_* only, and there is no dynamic
-- SQL. search_path is pinned so a caller cannot swap in its own objects. Each trigger's arguments
-- are that table's secret columns, which are left out of before/after; they must match
-- AUDIT_SECRET_COLUMNS in src/server/db/audit.ts, and the trigger list must match AUDITED_TABLES
-- (tests/integration/audit.int.test.ts checks both against the catalogue exactly).
CREATE FUNCTION public.audit_row() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public
AS $$
DECLARE
  secret text[] := coalesce(TG_ARGV, '{}'::text[]);
  old_row jsonb := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) - secret END;
  new_row jsonb := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) - secret END;
  source jsonb := coalesce(new_row, old_row);
BEGIN
  INSERT INTO public.audit_event (id, workspace_id, table_name, row_id, action, before, after, actor_user_id)
  VALUES (
    -- uuid v7: 48-bit unix milliseconds over a random v4 uuid, version bits set to 7.
    encode(set_bit(set_bit(overlay(uuid_send(gen_random_uuid())
      PLACING substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
      FROM 1 FOR 6), 52, 1), 53, 1), 'hex')::uuid,
    CASE WHEN TG_TABLE_NAME = 'workspace' THEN source ->> 'id' ELSE source ->> 'workspace_id' END::uuid,
    TG_TABLE_NAME,
    (source ->> 'id')::uuid,
    lower(TG_OP)::public.audit_action,
    old_row,
    new_row,
    nullif(current_setting('app.user_id', true), '')::uuid
  );
  RETURN NULL;
END
$$;
ALTER FUNCTION public.audit_row() OWNER TO roofy;
REVOKE ALL ON FUNCTION public.audit_row() FROM PUBLIC;

CREATE TRIGGER "workspace_audit" AFTER INSERT OR UPDATE OR DELETE ON "workspace" FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER "member_audit" AFTER INSERT OR UPDATE OR DELETE ON "member" FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER "crew_level_audit" AFTER INSERT OR UPDATE OR DELETE ON "crew_level" FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER "crew_member_audit" AFTER INSERT OR UPDATE OR DELETE ON "crew_member" FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER "rate_audit" AFTER INSERT OR UPDATE OR DELETE ON "rate" FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER "project_audit" AFTER INSERT OR UPDATE OR DELETE ON "project" FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER "stage_audit" AFTER INSERT OR UPDATE OR DELETE ON "stage" FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER "stage_completion_share_audit" AFTER INSERT OR UPDATE OR DELETE ON "stage_completion_share" FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER "progress_entry_audit" AFTER INSERT OR UPDATE OR DELETE ON "progress_entry" FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER "progress_share_audit" AFTER INSERT OR UPDATE OR DELETE ON "progress_share" FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER "work_log_audit" AFTER INSERT OR UPDATE OR DELETE ON "work_log" FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER "no_work_audit" AFTER INSERT OR UPDATE OR DELETE ON "no_work" FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER "expense_audit" AFTER INSERT OR UPDATE OR DELETE ON "expense" FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER "pay_run_audit" AFTER INSERT OR UPDATE OR DELETE ON "pay_run" FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER "pay_run_line_audit" AFTER INSERT OR UPDATE OR DELETE ON "pay_run_line" FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER "ledger_entry_audit" AFTER INSERT OR UPDATE OR DELETE ON "ledger_entry" FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER "statement_link_audit" AFTER INSERT OR UPDATE OR DELETE ON "statement_link" FOR EACH ROW EXECUTE FUNCTION public.audit_row('token_hash');
