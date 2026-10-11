/** Plain-words checks for the set-up wizard, shared by the form (as you type) and the fake service (on save). */
import type { Cents } from "@/domain/types";

export const ABN_DIGITS = "ABN should be 11 digits.";
export const NAME_BUSINESS = "Add your business name.";
export const NAME_CREW = "Add a name.";
export const RATE_MISSING = "Add an hourly rate.";
export const RATE_MISSING_DAILY = "Add a daily rate.";
export const RATE_UNREADABLE = "Enter a rate in dollars and cents, like 320.00.";

export interface BusinessProblems {
  name?: string;
  abn?: string;
}

export function businessProblems(input: { name: string; abn: string }): BusinessProblems {
  const out: BusinessProblems = {};
  if (input.name.trim() === "") out.name = NAME_BUSINESS;
  if (!/^\d{11}$/.test(input.abn.replace(/\s/g, ""))) out.abn = ABN_DIGITS;
  return out;
}

export interface CrewRowProblems {
  name?: string;
  rate?: string;
}

type CrewRowInput = { name: string; rateCents: Cents | null | "unreadable"; basis?: "hourly" | "daily" };

export function crewRowProblems(input: CrewRowInput): CrewRowProblems {
  const out: CrewRowProblems = {};
  if (input.name.trim() === "") out.name = NAME_CREW;
  if (input.rateCents === "unreadable") out.rate = RATE_UNREADABLE;
  else if (input.rateCents === null || input.rateCents <= 0) out.rate = input.basis === "daily" ? RATE_MISSING_DAILY : RATE_MISSING;
  return out;
}

/** The one line under a disabled Continue while a crew row is open: what the row still needs, in plain words. */
export function crewRowReason(input: CrewRowInput): string {
  const name = input.name.trim();
  const rateOk = typeof input.rateCents === "number" && input.rateCents > 0;
  if (name === "" && !rateOk) return "Add a name and a rate, or cancel.";
  if (name === "") return "Add a name, or cancel.";
  if (input.rateCents === "unreadable") return `Fix ${name}'s rate, or cancel.`;
  if (!rateOk) return `Add ${name}'s rate, or cancel.`;
  return `Tap Add to save ${name}, or cancel.`;
}
