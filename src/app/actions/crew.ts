"use server";
/** Crew records and dated rates (Owner/Manager). */
import { crewInputSchema, crewPatchSchema, idSchema, rateInputSchema } from "@/data/admin-inputs";
import type { ActionResult, CrewInput, Id, RateDto, RateInput } from "@/data/contracts";
import { act, PATHS } from "./run";

const CREW = [PATHS.crew, PATHS.log, PATHS.home];

export async function createCrewMember(input: CrewInput): Promise<ActionResult<{ id: Id }>> {
  return act([crewInputSchema], [input], ({ data, actor }, i) => data.crew.create(actor, i), CREW);
}

export async function updateCrewMember(
  crewMemberId: Id,
  input: Partial<CrewInput>,
): Promise<ActionResult<{ id: Id }>> {
  return act(
    [idSchema, crewPatchSchema],
    [crewMemberId, input],
    ({ data, actor }, id, i) => data.crew.update(actor, id, i),
    CREW,
  );
}

/**
 * A dated rate, optionally for one job; history is kept. Unapproved $0.00 missing-rate logs it now
 * covers take it, so pay runs, job costs and Home change too.
 */
export async function setRate(input: RateInput): Promise<ActionResult<{ rate: RateDto }>> {
  return act(
    [rateInputSchema],
    [input],
    async ({ data, actor }, i) => ({ rate: await data.crew.setRate(actor, i) }),
    [...CREW, PATHS.pay, PATHS.jobs, PATHS.reports],
  );
}
