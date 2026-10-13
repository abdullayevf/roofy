ALTER TABLE "workspace" DROP CONSTRAINT "workspace_working_days_range";--> statement-breakpoint
ALTER TABLE "stage" DROP CONSTRAINT "stage_manual_pct_bp_range";--> statement-breakpoint
CREATE INDEX "invitation_inviter_id_idx" ON "invitation" USING btree ("inviter_id");--> statement-breakpoint
CREATE INDEX "project_workspace_id_client_id_idx" ON "project" USING btree ("workspace_id","client_id");--> statement-breakpoint
CREATE INDEX "project_assignment_workspace_id_project_id_idx" ON "project_assignment" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "stage_template_item_workspace_id_template_id_idx" ON "stage_template_item" USING btree ("workspace_id","template_id");--> statement-breakpoint
CREATE INDEX "crew_member_workspace_id_level_id_idx" ON "crew_member" USING btree ("workspace_id","level_id");--> statement-breakpoint
CREATE INDEX "rate_workspace_id_project_id_idx" ON "rate" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "stage_completion_share_workspace_id_crew_member_id_idx" ON "stage_completion_share" USING btree ("workspace_id","crew_member_id");--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_working_days_range" CHECK ("workspace"."working_days" <@ '{0,1,2,3,4,5,6}'::smallint[] and cardinality("workspace"."working_days") between 1 and 7);--> statement-breakpoint
ALTER TABLE "stage" ADD CONSTRAINT "stage_manual_pct_bp_step" CHECK ("stage"."manual_pct_bp" in (0, 2500, 5000, 7500, 10000));