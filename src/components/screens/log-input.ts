import type { CrewDayEntry, GridCrewForeman } from "@/data/contracts";
import type { Hundredths } from "@/domain/types";
import type { CrewBasisLabel } from "@/components/crew-chip";

type GridPerson = Pick<GridCrewForeman, "crewMemberId" | "basis" | "unit" | "standardHours">;
type Loggable = GridPerson & Pick<GridCrewForeman, "noWorkOnDate" | "loggedOnDate">;

/** Someone marked no work, or already logged for the date, gets no new crew-day entry. */
export function canLog(p: Pick<GridCrewForeman, "noWorkOnDate" | "loggedOnDate">): boolean {
  return p.noWorkOnDate === null && !p.loggedOnDate;
}

/** The ids from `ids` that are on the crew and can be logged (what may start ticked). */
export function pickableIds(crew: Pick<Loggable, "crewMemberId" | "noWorkOnDate" | "loggedOnDate">[], ids: string[]): string[] {
  return ids.filter((id) => crew.some((c) => c.crewMemberId === id && canLog(c)));
}

/** The sentence under a disabled Save day: only what is still missing, or undefined when nothing is. */
export function crewDayHint(s: { job: boolean; stage: boolean; people: boolean }): string | undefined {
  const choose = !s.job ? "Choose a job and a stage" : !s.stage ? "Choose a stage" : null;
  if (choose === null) return s.people ? undefined : "Tick at least one person.";
  if (s.people) return `${choose}.`;
  return `${choose}${s.job ? "" : ","} and tick at least one person.`;
}

/** The usual basis as the chip shows it: never a rate. */
export function basisLabel(p: Pick<GridPerson, "basis" | "unit">): CrewBasisLabel {
  if (p.basis === "daily") return "Day";
  if (p.basis === "hourly") return "Hourly";
  if (p.unit === "m2") return "m²";
  if (p.unit === "lm") return "lm";
  if (p.unit === "each") return "Each";
  return "Hours only";
}

/** Daily people toggle a full or half day; everyone else sets hours. */
export function exceptionFor(basis: GridPerson["basis"]): "half-day" | "hours" {
  return basis === "daily" ? "half-day" : "hours";
}

/** A fresh day: a full day, or the workspace's standard hours (nothing is copied from yesterday). */
export function initialException(p: Pick<GridPerson, "basis" | "standardHours">): Hundredths {
  return p.basis === "daily" ? 100 : p.standardHours;
}

/** The entries to save: the ticked people, each on their basis. Hours for a day = days x the standard day. */
export function buildEntries(
  crew: Loggable[],
  ticked: ReadonlySet<string>,
  exceptions: Readonly<Record<string, Hundredths>>,
  /** Overtime for hourly people: 100 (normal), 150 or 200. */
  multipliers: Readonly<Record<string, Hundredths>> = {},
): CrewDayEntry[] {
  return crew
    .filter((p) => ticked.has(p.crewMemberId) && canLog(p))
    .map((p): CrewDayEntry => {
      const value = exceptions[p.crewMemberId] ?? initialException(p);
      if (p.basis === "daily") {
        return {
          crewMemberId: p.crewMemberId,
          basis: "daily",
          days: value,
          hours: Math.round((p.standardHours * value) / 100),
          multiplier: null,
        };
      }
      if (p.basis === "hourly") {
        return { crewMemberId: p.crewMemberId, basis: "hourly", days: null, hours: value, multiplier: multipliers[p.crewMemberId] ?? 100 };
      }
      return { crewMemberId: p.crewMemberId, basis: "time_only", days: null, hours: value, multiplier: null };
    });
}

/** The longest day a person can be logged for by hours. */
const MAX_HOURS: Hundredths = 2400;

/**
 * The days, hours and overtime from an address that still make sense for these people: a half or full day for a
 * daily person, up to 24 hours for anyone else, overtime for hourly people only. (Changing the stage can change a
 * person's basis, and an old value must not follow them.)
 */
export function usablePicks(
  crew: Pick<GridPerson, "crewMemberId" | "basis">[],
  values: Readonly<Record<string, Hundredths>>,
  multipliers: Readonly<Record<string, Hundredths>>,
): { values: Record<string, Hundredths>; multipliers: Record<string, Hundredths> } {
  const out = { values: {} as Record<string, Hundredths>, multipliers: {} as Record<string, Hundredths> };
  for (const p of crew) {
    const value = values[p.crewMemberId];
    if (value === undefined) continue;
    if (p.basis === "daily" ? value !== 50 && value !== 100 : value > MAX_HOURS) continue;
    out.values[p.crewMemberId] = value;
    const multiplier = multipliers[p.crewMemberId];
    if (p.basis === "hourly" && multiplier !== undefined) out.multipliers[p.crewMemberId] = multiplier;
  }
  return out;
}
