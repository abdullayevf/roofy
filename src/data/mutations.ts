/**
 * Zod schemas for field entries (architecture §7): the mutation envelope, one payload schema per
 * `MutationType`, and the push request. Every rejection message is a plain sentence that says how
 * to fix the entry — the phone shows it verbatim under "Needs attention" (flows "Outbox needs
 * attention"), so it never names a schema, a field key or a dollar figure.
 *
 * Shared primitives (`idSchema`, `localDateSchema`, …) and `plainIssue`/`firstIssue` are reused by
 * the admin schemas in `./admin-inputs`.
 */
import { z } from "zod";
import { formatDecimal } from "@/lib/format";
import {
  MAX_PUSH_BATCH,
  MUTATION_TYPES,
  type FieldIssue,
  type MutationEnvelope,
  type MutationPayloads,
  type MutationType,
} from "./contracts";

// ─── Plain messages ─────────────────────────────────────────────────────────

const LABELS: Record<string, string> = {
  id: "entry id",
  createdAt: "created time",
  appVersion: "app version",
  payload: "entry",
  date: "date",
  projectId: "job",
  stageId: "stage",
  crewMemberId: "crew member",
  crewMemberIds: "crew",
  categoryId: "category",
  entries: "crew list",
  quantity: "quantity",
  hours: "hours",
  days: "days",
  multiplier: "overtime",
  note: "note",
  photoFileId: "photo",
  receiptFileId: "receipt photo",
  supplier: "supplier",
  totalCents: "total",
  gstCents: "GST",
  reason: "reason",
  basis: "pay basis",
  unit: "unit",
  amountCents: "amount",
  effectiveFrom: "start date",
  name: "name",
  email: "email",
  abn: "ABN",
};

/** zod's own messages start like this; ours never do. */
const ZOD_DEFAULT = /^(Invalid|Too (small|big)|Expected|Unrecognized)/;

export function labelFor(path: readonly PropertyKey[]): string {
  const key = [...path].reverse().find((p): p is string => typeof p === "string");
  if (key === undefined) return "entry";
  return LABELS[key] ?? key.replace(/([A-Z])/g, " $1").toLowerCase();
}

/** A zod issue as a sentence a person can act on. */
export function plainIssue(issue: z.core.$ZodIssue): string {
  if (!ZOD_DEFAULT.test(issue.message)) return issue.message;
  return `Check the ${labelFor(issue.path)} and try again.`;
}

export function fieldIssues(error: z.ZodError): FieldIssue[] {
  return error.issues.map((i) => ({ field: i.path.map(String).join("."), message: plainIssue(i) }));
}

export const firstIssue = (error: z.ZodError): string => plainIssue(error.issues[0]!);

/** 9200 → "92%", 9250 → "92.5%". */
export function percentText(bp: number): string {
  return `${formatDecimal(bp).replace(/\.?0+$/, "")}%`;
}

// ─── Primitives ─────────────────────────────────────────────────────────────

export const idSchema = z.string().min(1).max(64);
export const localDateSchema = z.iso.date({ error: "Pick a date." });
export const noteSchema = z
  .string()
  .trim()
  .max(500, { error: "Keep the note under 500 characters." })
  .nullable()
  .transform((v) => (v === "" ? null : v));
/** Hundredths of an hour, quarter-hour steps, up to 24 h. */
export const hoursSchema = z
  .int()
  .min(0)
  .max(2400, { error: "Hours can't be more than 24 in a day." })
  .multipleOf(25, { error: "Hours go in quarter-hour steps, like 7.5 or 7.75." });

const unique = (ids: readonly string[]) => new Set(ids).size === ids.length;

export const PAUSE_REASONS = ["weather", "materials", "client", "other_job", "other"] as const;
export const NO_WORK_REASONS = ["rain", "leave", "sick", "other"] as const;

export const sharesSchema = z.discriminatedUnion(
  "mode",
  [
    z.object({ mode: z.literal("equal") }),
    z.object({
      mode: z.literal("custom"),
      bp: z.array(
        z
          .int()
          .min(1, { error: "Each share must be more than 0%." })
          .max(10_000, { error: "A share can't be more than 100%." }),
      ),
    }),
  ],
  { error: "Choose an equal split or set each person's share." },
);

/** Custom shares: one per person, totalling exactly 100% (pay rules §4). */
export function checkShares(
  shares: z.infer<typeof sharesSchema>,
  people: number,
  ctx: z.RefinementCtx,
  path: PropertyKey[] = ["shares"],
): void {
  if (shares.mode !== "custom") return;
  if (shares.bp.length !== people) {
    ctx.addIssue({ code: "custom", message: "Give each person in the split a share.", path });
    return;
  }
  const total = shares.bp.reduce((a, b) => a + b, 0);
  if (total !== 10_000) {
    ctx.addIssue({
      code: "custom",
      message: `Shares must add up to 100%. Currently ${percentText(total)}.`,
      path,
    });
  }
}

// ─── Payloads ───────────────────────────────────────────────────────────────

const crewDayEntrySchema = z
  .object({
    crewMemberId: idSchema,
    basis: z.enum(["hourly", "daily", "time_only"], {
      error: "Choose day, hourly or time only for each person.",
    }),
    days: z.union([z.literal(100), z.literal(50)], { error: "A day is 1 or ½." }).nullable(),
    hours: hoursSchema,
    multiplier: z
      .int()
      .min(100, { error: "Overtime is between ×1.0 and ×3.0." })
      .max(300, { error: "Overtime is between ×1.0 and ×3.0." })
      .nullable(),
  })
  .superRefine((e, ctx) => {
    if (e.basis === "daily" && e.days === null)
      ctx.addIssue({ code: "custom", message: "Choose 1 day or ½ day.", path: ["days"] });
    if (e.basis !== "daily" && e.days !== null)
      ctx.addIssue({ code: "custom", message: "Only a daily row takes days.", path: ["days"] });
    if (e.basis !== "daily" && e.hours === 0)
      ctx.addIssue({ code: "custom", message: "Add the hours worked.", path: ["hours"] });
    if (e.basis !== "hourly" && e.multiplier !== null)
      ctx.addIssue({
        code: "custom",
        message: "Overtime only applies to hourly work.",
        path: ["multiplier"],
      });
  });

export const crewDaySchema = z.object({
  date: localDateSchema,
  projectId: idSchema,
  stageId: idSchema,
  entries: z
    .array(crewDayEntrySchema)
    .min(1, { error: "Tick at least one person who worked." })
    .max(60, { error: "That's more rows than one crew-day can hold. Split it into two." }),
});

export const progressSchema = z
  .object({
    stageId: idSchema,
    date: localDateSchema,
    quantity: z
      .int({ error: "Add the quantity done." })
      .positive({ error: "Add the quantity done." })
      .max(100_000_000, { error: "That quantity is too big. Check it and try again." }),
    crewMemberIds: z
      .array(idSchema)
      .min(1, { error: "Pick who did the work." })
      .max(30)
      .refine(unique, { error: "Each person can be in the split once." }),
    shares: sharesSchema,
    photoFileId: idSchema.nullable(),
    note: noteSchema,
  })
  .superRefine((p, ctx) => checkShares(p.shares, p.crewMemberIds.length, ctx));

export const noWorkSchema = z.object({
  crewMemberIds: z
    .array(idSchema)
    .min(1, { error: "Pick who didn't work." })
    .max(60)
    .refine(unique, { error: "Each person can be picked once." }),
  date: localDateSchema,
  reason: z.enum(NO_WORK_REASONS, { error: "Pick a reason: rain, leave, sick or other." }),
  note: noteSchema,
});

export const stagePauseSchema = z.object({
  stageId: idSchema,
  date: localDateSchema,
  reason: z.enum(PAUSE_REASONS, { error: "Pick why the stage is paused." }),
  note: noteSchema,
});

export const stageResumeSchema = z.object({ stageId: idSchema, date: localDateSchema });

/** The expense fields without the cross-field checks (the admin edit schema makes them optional). */
export const expenseFields = z.object({
  date: localDateSchema,
  supplier: z
    .string({ error: "Add the supplier." })
    .trim()
    .min(1, { error: "Add the supplier." })
    .max(120, { error: "Keep the supplier under 120 characters." }),
  totalCents: z
    .int({ error: "Add a total before saving." })
    .positive({ error: "Add a total before saving." })
    .max(100_000_000, { error: "That total is too big. Check it and try again." }),
  gstCents: z.int().min(0, { error: "GST can't be negative." }).nullable(),
  projectId: idSchema,
  stageId: idSchema.nullable(),
  categoryId: idSchema,
  paidBy: z.enum(["company_card", "cash", "crew"], {
    error: "Choose who paid: company card, cash or a crew member.",
  }),
  crewMemberId: idSchema.nullable(),
  receiptFileId: idSchema.nullable(),
});

export const expenseSchema = expenseFields.superRefine((e, ctx) => {
  if (e.gstCents !== null && e.gstCents > e.totalCents)
    ctx.addIssue({ code: "custom", message: "GST can't be more than the total.", path: ["gstCents"] });
  if (e.paidBy === "crew" && e.crewMemberId === null)
    ctx.addIssue({ code: "custom", message: "Pick who paid.", path: ["crewMemberId"] });
  if (e.paidBy !== "crew" && e.crewMemberId !== null)
    ctx.addIssue({
      code: "custom",
      message: "Only a crew-paid expense names a crew member.",
      path: ["crewMemberId"],
    });
});

/** One schema per field entry type; outputs are exactly the contract input types. */
export const PAYLOAD_SCHEMAS: { [T in MutationType]: z.ZodType<MutationPayloads[T]> } = {
  crew_day: crewDaySchema,
  progress: progressSchema,
  no_work: noWorkSchema,
  stage_pause: stagePauseSchema,
  stage_resume: stageResumeSchema,
  expense: expenseSchema,
};

// ─── Envelope and push request ──────────────────────────────────────────────

const envelopeSchema = z.object({
  id: z.uuid({ version: "v7", error: "This entry has a bad id. Discard it and enter it again." }),
  type: z.enum(MUTATION_TYPES as [MutationType, ...MutationType[]], {
    error: "This kind of entry can't be sent from the phone.",
  }),
  schemaVersion: z.literal(1, {
    error: "This entry came from a newer version of the app. Update the app, then send it again.",
  }),
  appVersion: z.string().min(1).max(40),
  createdAt: z.iso.datetime({ offset: true }),
  payload: z.unknown(),
});

export type ParsedMutation =
  { ok: true; envelope: MutationEnvelope } | { ok: false; id: string | null; message: string };

/** Envelope first, then the payload for its type. The first problem found is the message. */
export function parseMutation(raw: unknown): ParsedMutation {
  const rawId =
    raw !== null && typeof raw === "object" && typeof (raw as { id?: unknown }).id === "string"
      ? (raw as { id: string }).id
      : null;
  const env = envelopeSchema.safeParse(raw);
  if (!env.success) return { ok: false, id: rawId, message: firstIssue(env.error) };
  const payload = PAYLOAD_SCHEMAS[env.data.type].safeParse(env.data.payload);
  if (!payload.success) return { ok: false, id: env.data.id, message: firstIssue(payload.error) };
  return { ok: true, envelope: { ...env.data, payload: payload.data } as MutationEnvelope };
}

const pushRequestSchema = z.object(
  {
    mutations: z
      .array(
        z.looseObject(
          {
            id: z.string({ error: "Every entry needs an id." }).min(1, { error: "Every entry needs an id." }),
          },
          {
            error: "Every entry needs an id.",
          },
        ),
        { error: "Send a list of entries." },
      )
      .max(MAX_PUSH_BATCH, { error: `Send at most ${MAX_PUSH_BATCH} entries at a time.` }),
  },
  { error: "Send a list of entries." },
);

/**
 * The request's outer shape only: ≤ 25 objects, each with a string id (a response is keyed by id).
 * Each mutation is then parsed on its own (`parseMutation`) so one bad entry doesn't sink the rest.
 */
export function parsePushRequest(
  raw: unknown,
): { ok: true; mutations: ({ id: string } & Record<string, unknown>)[] } | { ok: false; message: string } {
  const r = pushRequestSchema.safeParse(raw);
  if (!r.success) return { ok: false, message: r.error.issues[0]!.message };
  return { ok: true, mutations: r.data.mutations };
}
