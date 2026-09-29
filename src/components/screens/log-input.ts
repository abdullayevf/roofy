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
        return { crewMemberId: p.crewMemberId, basis: "hourly", days: null, hours: value, multiplier: 100 };
      }
      return { crewMemberId: p.crewMemberId, basis: "time_only", days: null, hours: value, multiplier: null };
    });
}
