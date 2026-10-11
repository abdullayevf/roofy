/** Plain-words checks for the set-up wizard, shared by the form (as you type) and the fake service (on save). */
import type { Cents } from "@/domain/types";

export const ABN_DIGITS = "ABN should be 11 digits.";
export const NAME_BUSINESS = "Add your business name.";
export const NAME_CREW = "Add a name.";
export const RATE_MISSING = "Add a rate before adding.";
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

export function crewRowProblems(input: { name: string; rateCents: Cents | null | "unreadable" }): CrewRowProblems {
  const out: CrewRowProblems = {};
  if (input.name.trim() === "") out.name = NAME_CREW;
  if (input.rateCents === "unreadable") out.rate = RATE_UNREADABLE;
  else if (input.rateCents === null || input.rateCents <= 0) out.rate = RATE_MISSING;
  return out;
}
