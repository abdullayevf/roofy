"use server";
/** Jobs and stages (Owner/Manager). Stages of a new job come from the last same-type job or the template. */
import {
  clientInputSchema,
  idSchema,
  projectInputSchema,
  projectPatchSchema,
  stagePatchSchema,
} from "@/data/admin-inputs";
import type { ActionResult, Client, ClientInput, Id, ProjectInput, StageInput } from "@/data/contracts";
import { act, PATHS } from "./run";

const JOBS = [PATHS.home, PATHS.jobs, PATHS.reports];

export async function createProject(input: ProjectInput): Promise<ActionResult<{ id: Id }>> {
  return act([projectInputSchema], [input], ({ data, actor }, i) => data.projects.create(actor, i), JOBS);
}

export async function updateProject(
  projectId: Id,
  input: Partial<ProjectInput>,
): Promise<ActionResult<{ id: Id }>> {
  return act(
    [idSchema, projectPatchSchema],
    [projectId, input],
    ({ data, actor }, id, i) => data.projects.update(actor, id, i),
    JOBS,
  );
}

export async function updateStage(
  stageId: Id,
  input: Partial<StageInput>,
): Promise<ActionResult<{ id: Id }>> {
  return act(
    [idSchema, stagePatchSchema],
    [stageId, input],
    ({ data, actor }, id, i) => data.projects.updateStage(actor, id, i),
    JOBS,
  );
}

export async function createClient(input: ClientInput): Promise<ActionResult<{ client: Client }>> {
  return act(
    [clientInputSchema],
    [input],
    async ({ data, actor }, i) => ({ client: await data.projects.createClient(actor, i) }),
    [PATHS.jobs],
  );
}
