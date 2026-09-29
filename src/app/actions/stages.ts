"use server";
/** Stage Start / Done (lump-sum split) / Reopen / manual % — Owner and Manager (never a foreman). */
import { idSchema, localDateSchema, manualPctSchema, stageDoneSchema } from "@/data/admin-inputs";
import type {
  ActionResult,
  DoneProposal,
  EntryResult,
  Id,
  LocalDate,
  ManualPctBp,
  StageDoneInput,
} from "@/data/contracts";
import { act, PATHS } from "./run";

const STAGE = [PATHS.home, PATHS.jobs, PATHS.log, PATHS.reports];
/** Done and reopen move lump-sum pay, so pay runs and balances change too. */
const STAGE_PAY = [...STAGE, PATHS.pay, PATHS.crew];

export async function startStage(
  stageId: Id,
  date: LocalDate,
): Promise<ActionResult<{ result: EntryResult }>> {
  return act(
    [idSchema, localDateSchema],
    [stageId, date],
    async ({ data, actor }, id, d) => ({ result: await data.stages.start(actor, id, d) }),
    STAGE,
  );
}

/** The Done screen's proposal (equal split among everyone who logged), for a chosen completion date. */
export async function proposeStageDone(
  stageId: Id,
  completedOn: LocalDate,
): Promise<ActionResult<{ proposal: DoneProposal }>> {
  return act(
    [idSchema, localDateSchema],
    [stageId, completedOn],
    async ({ data, actor }, id, d) => ({ proposal: await data.stages.doneProposal(actor, id, d) }),
    [],
  );
}

/** Mark Done with the confirmed lump-sum split (custom shares must total 100%). */
export async function confirmStageDone(
  input: StageDoneInput,
): Promise<ActionResult<{ result: EntryResult }>> {
  return act(
    [stageDoneSchema],
    [input],
    async ({ data, actor }, i) => ({ result: await data.stages.confirmDone(actor, i) }),
    STAGE_PAY,
  );
}

/** Reopen a Done stage: unapproved lump-sum logs are deleted, approved ones reversed (pay rules §5, §8). */
export async function reopenStage(stageId: Id): Promise<ActionResult<{ result: EntryResult }>> {
  return act(
    [idSchema],
    [stageId],
    async ({ data, actor }, id) => ({ result: await data.stages.reopen(actor, id) }),
    STAGE_PAY,
  );
}

export async function setStageManualPct(
  stageId: Id,
  pctBp: ManualPctBp,
): Promise<ActionResult<{ result: EntryResult }>> {
  return act(
    [idSchema, manualPctSchema],
    [stageId, pctBp],
    async ({ data, actor }, id, pct) => ({ result: await data.stages.setManualPct(actor, id, pct) }),
    STAGE,
  );
}
