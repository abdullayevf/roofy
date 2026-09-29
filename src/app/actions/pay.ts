"use server";
/** Pay runs (approve, reopen, CSV export, statement links) and payouts. */
import { z } from "zod";
import { idSchema, payoutSchema } from "@/data/admin-inputs";
import type { ActionResult, Cents, Id, PayoutInput, PayRunReview, StatementShare } from "@/data/contracts";
import { act, PATHS } from "./run";

const PAY = [PATHS.home, PATHS.pay, PATHS.crew, PATHS.jobs, PATHS.reports, PATHS.history];
const approveOptions = z.object({ waiveMissingRate: z.boolean().optional() }).optional();

/**
 * Approve (Owner/Manager): blocked while Owner 2FA is off, and by a missing rate unless
 * `waiveMissingRate` (audited). Freezes lines, locks logs, posts ledger credits.
 */
export async function approvePayRun(
  payRunId: Id,
  options?: { waiveMissingRate?: boolean },
): Promise<ActionResult<{ payRun: PayRunReview }>> {
  return act(
    [idSchema, approveOptions],
    [payRunId, options],
    async ({ data, actor }, id, o) => ({ payRun: await data.payRuns.approve(actor, id, o) }),
    PAY,
  );
}

/** Reopen (Owner/Manager) only while no later pay run is approved. */
export async function reopenPayRun(payRunId: Id): Promise<ActionResult<{ payRun: PayRunReview }>> {
  return act(
    [idSchema],
    [payRunId],
    async ({ data, actor }, id) => ({ payRun: await data.payRuns.reopen(actor, id) }),
    PAY,
  );
}

/**
 * CSV of an approved run for Xero/MYOB (date, person, ABN, job, stage, basis, qty, unit, hours,
 * rate, amount, GST, total) — marks it Exported. Owner, Manager, Accountant.
 */
export async function exportPayRunCsv(
  payRunId: Id,
): Promise<ActionResult<{ filename: string; contentType: string; csv: string }>> {
  return act(
    [idSchema],
    [payRunId],
    async ({ data, actor }, id) => {
      const file = await data.payRuns.exportCsv(actor, id);
      return { filename: file.filename, contentType: file.contentType, csv: file.body };
    },
    [PATHS.pay, PATHS.home],
  );
}

/** A private, revocable 90-day statement link (approved runs only). */
export async function shareStatement(
  payRunId: Id,
  crewMemberId: Id,
): Promise<ActionResult<{ share: StatementShare }>> {
  return act(
    [idSchema, idSchema],
    [payRunId, crewMemberId],
    async ({ data, actor }, run, crew) => ({ share: await data.payRuns.shareStatement(actor, run, crew) }),
    [PATHS.crew],
  );
}

/** Record an advance or payment (Owner/Manager). Record only; no money moves. */
export async function recordPayout(
  input: PayoutInput,
): Promise<ActionResult<{ id: Id; balanceCents: Cents }>> {
  return act([payoutSchema], [input], ({ data, actor }, i) => data.ledger.recordPayout(actor, i), PAY);
}
