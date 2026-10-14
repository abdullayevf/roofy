"use server";
/** The set-up wizard's saves (prototype): each one moves the wizard on and returns where it is now. */
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getOnboardingWrite } from "@/data";
import {
  isDataError,
  type ActionResult,
  type OnboardingService,
  type OnboardingState,
} from "@/data/contracts";
import { fieldIssues, firstIssue } from "@/data/mutations";

type Result = ActionResult<{ state: OnboardingState }>;

const business = z.object({ name: z.string().max(200), abn: z.string().max(40), gstRegistered: z.boolean() });
const crew = z.object({
  name: z.string().max(200),
  type: z.enum(["employee", "contractor"]),
  levelId: z.string().max(100).nullable(),
  basis: z.enum(["hourly", "daily"]),
  rateCents: z.number().int().min(0).max(100_000_000),
});

async function run(
  work: (o: OnboardingService, actor: Parameters<OnboardingService["state"]>[0]) => Promise<OnboardingState>,
): Promise<Result> {
  try {
    const { onboarding, actor } = await getOnboardingWrite();
    return { ok: true, state: await work(onboarding, actor) };
  } catch (e) {
    unstable_rethrow(e); // Next's own throws (an expired session's redirect to /sign-in) are not form errors
    if (isDataError(e)) return { ok: false, code: e.code, message: e.message, issues: [...e.issues] };
    console.error(e);
    return { ok: false, code: "unavailable", message: "Couldn't save this. Try again.", issues: [] };
  }
}

function refuse(error: z.ZodError): Result {
  return { ok: false, code: "invalid", message: firstIssue(error), issues: fieldIssues(error) };
}

export async function saveBusiness(input: z.input<typeof business>): Promise<Result> {
  const p = business.safeParse(input);
  return p.success ? run((o, a) => o.saveBusiness(a, p.data)) : refuse(p.error);
}

export async function chooseTrade(): Promise<Result> {
  return run((o, a) => o.chooseTrade(a, "roofing"));
}

export async function acceptDefaults(): Promise<Result> {
  return run((o, a) => o.acceptDefaults(a));
}

export async function addCrewRow(input: z.input<typeof crew>): Promise<Result> {
  const p = crew.safeParse(input);
  return p.success ? run((o, a) => o.addCrew(a, p.data)) : refuse(p.error);
}

export async function finishCrew(): Promise<Result> {
  return run((o, a) => o.finishCrew(a));
}

export async function stepBack(): Promise<Result> {
  return run((o, a) => o.back(a));
}

export async function finishSetUp(): Promise<Result> {
  return run((o, a) => o.finish(a));
}
