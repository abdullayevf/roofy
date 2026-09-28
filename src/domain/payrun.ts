import { floorCheck, type FloorResult } from "./floor";
import { personTotals, type PersonTotals } from "./gst";
import { sum } from "./money";
import type { PayPeriod } from "./periods";
import type { Basis, Cents, Hundredths, LocalDate, LogSource, WorkerType } from "./types";

export interface PayLog {
  id: string;
  crewMemberId: string;
  date: LocalDate;
  projectId: string;
  stageId: string;
  basis: Basis;
  source: LogSource;
  quantity: Hundredths;
  hours: Hundredths;
  rateCents: Cents | null;
  amountCents: Cents;
  missingRate: boolean;
  /** True once the log belongs to an approved pay run. */
  locked: boolean;
}

export interface PayReimbursement {
  expenseId: string;
  crewMemberId: string;
  date: LocalDate;
  /** GST-inclusive amount the person paid. */
  amountCents: Cents;
  reimbursed: boolean;
}

export interface PayPerson {
  id: string;
  type: WorkerType;
  gstRegistered: boolean;
  floorHourlyCents: Cents | null;
}

export type LineLabel = "normal" | "late" | "adjustment";

export interface PayLine {
  log: PayLog;
  label: LineLabel;
}

export interface PersonPay {
  crewMemberId: string;
  lines: PayLine[];
  reimbursements: PayReimbursement[];
  totals: PersonTotals;
  hours: Hundredths;
  floor: FloorResult | null;
  noHours: boolean;
  missingRate: boolean;
}

const byDateProjectStage = (a: PayLog, b: PayLog) =>
  a.date.localeCompare(b.date) ||
  a.projectId.localeCompare(b.projectId) ||
  a.stageId.localeCompare(b.stageId);

const labelFor = (log: PayLog, period: PayPeriod): LineLabel =>
  log.source === "adjustment" ? "adjustment" : log.date < period.start ? "late" : "normal";

/** Pay rules §6–§10: the draft pay run for a period. */
export function buildPayRun(
  period: PayPeriod,
  people: readonly PayPerson[],
  logs: readonly PayLog[],
  reimbursements: readonly PayReimbursement[],
): PersonPay[] {
  const openLogs = logs.filter((l) => !l.locked && l.date <= period.end);
  const openReimbursements = reimbursements.filter((r) => !r.reimbursed && r.date <= period.end);
  return people.flatMap((p) => {
    const lines = openLogs
      .filter((l) => l.crewMemberId === p.id)
      .sort(byDateProjectStage)
      .map((log) => ({ log, label: labelFor(log, period) }));
    const rs = openReimbursements.filter((r) => r.crewMemberId === p.id);
    if (lines.length === 0 && rs.length === 0) return [];
    const subtotal = sum(lines.map((l) => l.log.amountCents));
    const hours = sum(lines.map((l) => l.log.hours));
    const floorRate = p.type === "employee" ? p.floorHourlyCents : null;
    return [
      {
        crewMemberId: p.id,
        lines,
        reimbursements: rs,
        totals: personTotals(p, subtotal, sum(rs.map((r) => r.amountCents))),
        hours,
        floor: floorRate !== null && hours > 0 ? floorCheck(subtotal, hours, floorRate) : null,
        noHours: p.type === "employee" && subtotal !== 0 && hours === 0,
        missingRate: lines.some((l) => l.log.missingRate),
      },
    ];
  });
}
