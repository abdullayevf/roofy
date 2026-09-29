/**
 * Zod schemas for the admin Server Functions (`src/app/actions/*`): what a form may send, in plain
 * words when it's wrong. Business rules that need the data (does the client exist? is the stage
 * done?) stay in the services. Outputs are exactly the contract input types.
 */
import { z } from "zod";
import type {
  CategoryInput,
  ClientInput,
  CrewInput,
  LevelInput,
  ManualPctBp,
  MemberInput,
  PayoutInput,
  ProjectInput,
  RateInput,
  StageDoneInput,
  StageInput,
  TemplateInput,
  WorkspaceSettingsInput,
} from "./contracts";
import {
  checkShares,
  expenseFields,
  hoursSchema,
  idSchema,
  localDateSchema,
  noteSchema,
  sharesSchema,
} from "./mutations";

const MAX_CENTS = 1_000_000_000;

const text = (message: string, max = 120) =>
  z
    .string({ error: message })
    .trim()
    .min(1, { error: message })
    .max(max, { error: `Keep it under ${max} characters.` });
const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, { error: `Keep it under ${max} characters.` })
    .nullable()
    .transform((v) => (v === "" ? null : v));
const cents = (message: string) =>
  z.int({ error: message }).min(0, { error: message }).max(MAX_CENTS, { error: message });
const positiveCents = (message: string) =>
  z.int({ error: message }).positive({ error: message }).max(MAX_CENTS, { error: message });

const unitSchema = z.enum(["m2", "lm", "each"], { error: "Pick a unit: m², lm or each." });
const jobTypeSchema = z.enum(["metal_reroof", "tile_reroof", "restoration", "repair", "new_build"], {
  error: "Pick a job type.",
});
const statusSchema = z.enum(["quoted", "active", "on_hold", "complete", "closed"], {
  error: "Pick a status.",
});
const roleSchema = z.enum(["owner", "manager", "foreman", "accountant"], { error: "Pick a role." });
const abnSchema = z
  .string()
  .trim()
  .regex(/^\d{2} ?\d{3} ?\d{3} ?\d{3}$/, { error: "An ABN is 11 digits, like 51 824 753 556." });

// ─── Projects and stages ────────────────────────────────────────────────────

const stageFields = z.object({
  name: text("Add a name for the stage."),
  position: z.int().min(1).max(100),
  unit: unitSchema.nullable(),
  plannedQuantity: z
    .int()
    .positive({ error: "The planned quantity must be more than 0." })
    .max(100_000_000)
    .nullable(),
  labourBudgetCents: cents("Check the labour budget."),
  materialsBudgetCents: cents("Check the materials budget."),
  lumpSumCents: positiveCents("A lump sum must be more than $0.00.").nullable(),
});

export const stageInputSchema: z.ZodType<StageInput> = stageFields;
export const stagePatchSchema: z.ZodType<Partial<StageInput>> = stageFields.partial();

const projectFields = z.object({
  clientId: idSchema,
  nickname: text("Add a name for the job."),
  siteAddress: text("Add the site address.", 200),
  jobType: jobTypeSchema,
  contractCents: cents("Check the contract value."),
  status: statusSchema,
  startDate: localDateSchema.nullable(),
  targetFinish: localDateSchema.nullable(),
  stages: z.array(stageFields).max(40).optional(),
});

const finishAfterStart = (
  p: { startDate?: string | null; targetFinish?: string | null },
  ctx: z.RefinementCtx,
) => {
  if (p.startDate && p.targetFinish && p.targetFinish < p.startDate)
    ctx.addIssue({
      code: "custom",
      message: "The target finish can't be before the start.",
      path: ["targetFinish"],
    });
};

export const projectInputSchema: z.ZodType<ProjectInput> = projectFields.superRefine(finishAfterStart);
export const projectPatchSchema: z.ZodType<Partial<ProjectInput>> = projectFields
  .omit({ stages: true })
  .partial()
  .superRefine(finishAfterStart);

export const clientInputSchema: z.ZodType<ClientInput> = z.object({
  name: text("Add the client's name."),
  phone: optionalText(40),
  email: z.email({ error: "Check the email address." }).nullable(),
  address: optionalText(200),
});

export const stageDoneSchema: z.ZodType<StageDoneInput> = z
  .object({
    stageId: idSchema,
    completedOn: localDateSchema,
    note: noteSchema,
    photoFileId: idSchema.nullable(),
    crewMemberIds: z
      .array(idSchema)
      .max(30)
      .refine((ids) => new Set(ids).size === ids.length, { error: "Each person can be in the split once." }),
    shares: sharesSchema,
  })
  .superRefine((d, ctx) => checkShares(d.shares, d.crewMemberIds.length, ctx));

export const manualPctSchema: z.ZodType<ManualPctBp> = z.union(
  [z.literal(0), z.literal(2500), z.literal(5000), z.literal(7500), z.literal(10000)],
  { error: "Pick 0%, 25%, 50%, 75% or 100%." },
);

// ─── Crew, rates, payouts ───────────────────────────────────────────────────

const crewFields = z.object({
  name: text("Add the person's name.", 80),
  phone: optionalText(40),
  type: z.enum(["employee", "contractor"], { error: "Choose employee or ABN contractor." }),
  levelId: idSchema.nullable(),
  abn: abnSchema.nullable(),
  gstRegistered: z.boolean(),
  activeFrom: localDateSchema,
  activeTo: localDateSchema.nullable(),
  defaultBasis: z.enum(["hourly", "daily", "per_unit"], { error: "Choose how they're usually paid." }),
  defaultUnit: unitSchema.nullable(),
});

export const crewInputSchema: z.ZodType<CrewInput> = crewFields.superRefine((m, ctx) => {
  if (m.type === "contractor" && m.abn === null)
    ctx.addIssue({ code: "custom", message: "Add the ABN for a contractor.", path: ["abn"] });
  if (m.defaultBasis === "per_unit" && m.defaultUnit === null)
    ctx.addIssue({
      code: "custom",
      message: "Pick the unit this person is paid by: m², lm or each.",
      path: ["defaultUnit"],
    });
});
export const crewPatchSchema: z.ZodType<Partial<CrewInput>> = crewFields.partial();

export const rateInputSchema: z.ZodType<RateInput> = z
  .object({
    crewMemberId: idSchema,
    basis: z.enum(["hourly", "daily", "per_unit"], { error: "Choose hourly, daily or per unit." }),
    unit: unitSchema.nullable(),
    amountCents: positiveCents("Add a rate above $0.00."),
    effectiveFrom: localDateSchema,
    projectId: idSchema.nullable(),
  })
  .superRefine((r, ctx) => {
    if (r.basis === "per_unit" && r.unit === null)
      ctx.addIssue({
        code: "custom",
        message: "Pick the unit this rate is for: m², lm or each.",
        path: ["unit"],
      });
  });

export const payoutSchema: z.ZodType<PayoutInput> = z.object({
  crewMemberId: idSchema,
  date: localDateSchema,
  amountCents: positiveCents("Add an amount before saving."),
  kind: z.enum(["advance", "payment"], { error: "Choose Advance or Payment." }),
  method: z.enum(["bank_transfer", "cash", "other"], { error: "Choose how it was paid." }),
  note: noteSchema,
});

// ─── Logs and expenses (edits of saved records) ─────────────────────────────

export const logEditSchema = z
  .object({
    hours: hoursSchema.optional(),
    days: z.union([z.literal(100), z.literal(50)], { error: "A day is 1 or ½." }).optional(),
    quantity: z.int().positive().optional(),
  })
  .refine((e) => e.hours !== undefined || e.days !== undefined || e.quantity !== undefined, {
    error: "Change the hours or days before saving.",
  });

export const expensePatchSchema = expenseFields.partial();

// ─── Settings ───────────────────────────────────────────────────────────────

export const settingsSchema: z.ZodType<WorkspaceSettingsInput> = z.object({
  name: text("Add the business name."),
  abn: abnSchema,
  gstRegistered: z.boolean(),
  timezone: text("Pick a timezone from the list.", 60),
  payFrequency: z.enum(["weekly", "fortnightly"], { error: "Choose weekly or fortnightly." }),
  payWeekStart: z.int().min(0).max(6),
  payAnchor: localDateSchema,
  workingDays: z.array(z.int().min(0).max(6)).min(1, { error: "Pick at least one working day." }).max(7),
  standardDayHours: hoursSchema.refine((h) => h > 0, { error: "A standard day needs some hours." }),
  onCostBp: z
    .int()
    .min(0, { error: "On-cost is between 0% and 100%." })
    .max(10_000, { error: "On-cost is between 0% and 100%." }),
});

export const levelSchema: z.ZodType<LevelInput> = z.object({
  id: idSchema.nullable(),
  name: text("Add a name for the level.", 60),
  floorRateCents: positiveCents("Add a floor rate before saving."),
});

export const categorySchema: z.ZodType<CategoryInput> = z.object({
  id: idSchema.nullable(),
  name: text("Add a name for the category.", 60),
  position: z.int().min(0).max(1000),
});

export const templateSchema: z.ZodType<TemplateInput> = z.object({
  jobType: jobTypeSchema,
  items: z
    .array(
      z.object({
        name: text("Add a name for each stage."),
        position: z.int().min(1).max(100),
        defaultUnit: unitSchema.nullable(),
        labourShareBp: z.int().min(0).max(10_000),
        materialsShareBp: z.int().min(0).max(10_000),
      }),
    )
    .min(1, { error: "Add at least one stage." })
    .max(40),
});

export const memberSchema: z.ZodType<MemberInput> = z.object({
  email: z.email({ error: "Check the email address." }),
  name: text("Add the person's name.", 80),
  role: roleSchema,
});

export { idSchema, localDateSchema, roleSchema };
export const idListSchema = z.array(idSchema).max(500);
