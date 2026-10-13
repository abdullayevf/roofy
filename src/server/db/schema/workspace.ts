// The workspace (Better Auth's organization model), its members and invitations, and the shared
// enums and tenant columns every workspace-owned table uses.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type { OnboardingStep, Role } from "@/data/contracts";
import type { PayFrequency } from "@/domain/periods";
import { user } from "./auth";
import { allOf, hundredths, id, localDate, timestamps, timestamptz } from "./columns";

export const roleEnum = pgEnum("member_role", allOf<Role>()(["owner", "manager", "foreman", "accountant"]));
export const payFrequencyEnum = pgEnum("pay_frequency", allOf<PayFrequency>()(["weekly", "fortnightly"]));
export const onboardingStepEnum = pgEnum(
  "onboarding_step",
  allOf<OnboardingStep>()(["business", "trade", "defaults", "crew", "install", "done"]),
);
export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "rejected",
  "canceled",
]);

export const workspace = pgTable(
  "workspace",
  {
    id: id(),
    name: text("name").notNull(),
    /** Better Auth organization fields. */
    slug: text("slug").unique(),
    logo: text("logo"),
    metadata: text("metadata"),
    abn: text("abn"),
    gstRegistered: boolean("gst_registered").notNull().default(false),
    timezone: text("timezone").notNull().default("Australia/Sydney"),
    payPeriod: payFrequencyEnum("pay_period").notNull().default("weekly"),
    /** 0 = Sunday … 6 = Saturday. */
    payWeekStart: smallint("pay_week_start").notNull().default(1),
    /** A date a pay period starts on (anchors fortnightly periods). */
    payAnchor: localDate("pay_anchor"),
    workingDays: smallint("working_days")
      .array()
      .notNull()
      .default(sql`'{1,2,3,4,5}'::smallint[]`),
    standardDayHours: hundredths("standard_day_hours").notNull().default("8.00"),
    onCostBp: integer("on_cost_bp").notNull().default(0),
    /** Decision 4: the set-up wizard resumes where it stopped. */
    trade: text("trade"),
    onboardingStep: onboardingStepEnum("onboarding_step").notNull().default("business"),
    ...timestamps(),
  },
  (t) => [
    check("workspace_pay_week_start_range", sql`${t.payWeekStart} between 0 and 6`),
    check(
      "workspace_working_days_range",
      sql`${t.workingDays} <@ '{0,1,2,3,4,5,6}'::smallint[] and cardinality(${t.workingDays}) between 1 and 7`,
    ),
    check("workspace_on_cost_bp_range", sql`${t.onCostBp} >= 0`),
    check(
      "workspace_standard_day_hours_range",
      sql`${t.standardDayHours} > 0 and ${t.standardDayHours} <= 24`,
    ),
    check("workspace_trade_known", sql`${t.trade} is null or ${t.trade} = 'roofing'`),
  ],
);

/** `id`, `workspace_id` (cascade with the workspace), `created_at`, `updated_at`. */
export const tenantColumns = () => ({
  id: id(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  ...timestamps(),
});

/** Decision 3: the target of every composite (workspace_id, <parent>_id) foreign key. */
export const tenantKey = (table: string, t: { workspaceId: AnyPgColumn; id: AnyPgColumn }) =>
  unique(`${table}_workspace_id_id_key`).on(t.workspaceId, t.id);

export const member = pgTable(
  "member",
  {
    ...tenantColumns(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
  },
  (t) => [
    tenantKey("member", t),
    unique("member_workspace_id_user_id_key").on(t.workspaceId, t.userId),
    index("member_user_id_idx").on(t.userId),
  ],
);

export const invitation = pgTable(
  "invitation",
  {
    ...tenantColumns(),
    email: text("email").notNull(),
    role: roleEnum("role").notNull(),
    status: invitationStatusEnum("status").notNull().default("pending"),
    expiresAt: timestamptz("expires_at").notNull(),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    tenantKey("invitation", t),
    index("invitation_email_idx").on(t.email),
    index("invitation_inviter_id_idx").on(t.inviterId),
  ],
);
