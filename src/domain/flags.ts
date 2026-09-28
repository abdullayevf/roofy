import { isActiveOn, type StageSegment } from "./segments";
import type { Basis, LocalDate, LogSource } from "./types";

export interface FlagLog {
  id: string;
  crewMemberId: string;
  date: LocalDate;
  stageId: string;
  basis: Basis;
  source: LogSource;
  /** The grid submission or progress entry that created this log. */
  entryId: string;
}

export interface GroupFlag {
  crewMemberId: string;
  date: LocalDate;
  stageId: string;
  logIds: string[];
}

const TIME_BASED: ReadonlySet<Basis> = new Set(["hourly", "daily"]);
const OUTPUT_BASED: ReadonlySet<Basis> = new Set(["per_unit", "lump_sum"]);

function groups(logs: readonly FlagLog[], key: (l: FlagLog) => string): FlagLog[][] {
  const map = new Map<string, FlagLog[]>();
  for (const l of logs) map.set(key(l), [...(map.get(key(l)) ?? []), l]);
  return [...map.values()];
}

const toFlag = (g: FlagLog[]): GroupFlag => ({
  crewMemberId: g[0]!.crewMemberId,
  date: g[0]!.date,
  stageId: g[0]!.stageId,
  logIds: g.map((l) => l.id),
});

/** Pay rules §9: time-based and output-based pay on the same stage and date. */
export function doublePayFlags(logs: readonly FlagLog[]): GroupFlag[] {
  return groups(
    logs.filter((l) => l.source !== "adjustment"),
    (l) => `${l.crewMemberId}|${l.date}|${l.stageId}`,
  )
    .filter((g) => g.some((l) => TIME_BASED.has(l.basis)) && g.some((l) => OUTPUT_BASED.has(l.basis)))
    .map(toFlag);
}

/** Pay rules §9: same person, date, stage and basis created by different entries. */
export function duplicateFlags(logs: readonly FlagLog[]): GroupFlag[] {
  return groups(
    logs.filter((l) => l.source !== "adjustment"),
    (l) => `${l.crewMemberId}|${l.date}|${l.stageId}|${l.basis}`,
  )
    .filter((g) => new Set(g.map((l) => l.entryId)).size > 1)
    .map(toFlag);
}

/** Pay rules §9: logs dated when their stage was not active. */
export function pausedStageFlags(
  logs: readonly FlagLog[],
  segmentsByStage: ReadonlyMap<string, readonly StageSegment[]>,
): string[] {
  return logs
    .filter((l) => l.source !== "adjustment" && !isActiveOn(segmentsByStage.get(l.stageId) ?? [], l.date))
    .map((l) => l.id);
}
