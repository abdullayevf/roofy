import type { Cents, LocalDate, RateBasis, Unit } from "./types";

export interface RateRecord {
  id: string;
  crewMemberId: string;
  basis: RateBasis;
  unit: Unit | null;
  amountCents: Cents;
  effectiveFrom: LocalDate;
  projectId: string | null;
}

export interface RateQuery {
  crewMemberId: string;
  basis: RateBasis;
  unit: Unit | null;
  projectId: string;
  date: LocalDate;
}

function latest(list: readonly RateRecord[]): RateRecord | null {
  return list.reduce<RateRecord | null>(
    (best, r) => (best === null || r.effectiveFrom > best.effectiveFrom ? r : best),
    null,
  );
}

/** Pay rules §1: project override first, then default; latest effective_from ≤ date. */
export function resolveRate(rates: readonly RateRecord[], q: RateQuery): RateRecord | null {
  const candidates = rates.filter(
    (r) =>
      r.crewMemberId === q.crewMemberId &&
      r.basis === q.basis &&
      r.unit === q.unit &&
      r.effectiveFrom <= q.date,
  );
  return (
    latest(candidates.filter((r) => r.projectId === q.projectId)) ??
    latest(candidates.filter((r) => r.projectId === null))
  );
}
