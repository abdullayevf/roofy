/**
 * `?demo=<state>` design states for fake mode (plan Task 6). Ignored unless `ROOFY_DATA=fake`.
 *
 * | state       | what the fake does                                                              |
 * | ----------- | ------------------------------------------------------------------------------- |
 * | `empty`     | reads a new workspace with nothing but settings — every list is empty            |
 * | `loading`   | `demo.loading` is true; the page renders its skeleton (see `src/data/index.ts`) |
 * | `error`     | every service method throws `DataError("unavailable")` → the route's error.tsx  |
 * | `offline`   | `demo.offline` is true; the layout shows the offline banner                     |
 * | `waiting`   | `demo.outbox` holds 3 entries waiting to send (badge "3 to send")               |
 * | `attention` | `demo.outbox` holds 1 rejected entry with its reason; Home lists it             |
 * | `noperm`    | every service method throws `DataError("forbidden")` → the no-permission state  |
 * | `blocked`   | Owner 2FA reads as off → the pay run's Approve is blocked (`owner_2fa_off`)     |
 * | `mixed`     | `demo.outbox` holds one entry in each group: Needs attention, Sending, Waiting, Sent |
 */
import { addDays, todayIn } from "@/domain/dates";
import { DEMO_STATES, type DemoState, type Id, type OutboxEntry, type OutboxItem } from "../contracts";
import type { Seed } from "./seed";

export { DEMO_STATES };

/** A `searchParams` value (string or repeated) → a demo state, or null. */
export function parseDemoState(value: unknown): DemoState | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && (DEMO_STATES as readonly string[]).includes(raw)
    ? (raw as DemoState)
    : null;
}

export const isLoadingDemo = (state: DemoState | null): boolean => state === "loading";

export interface DemoFlags {
  state: DemoState | null;
  /** Render the page's skeleton instead of its content. */
  loading: boolean;
  /** Show the offline banner. */
  offline: boolean;
  /** The outbox the screen and badge show (device-local from Phase 5). */
  outbox: OutboxItem[];
}

export function demoFlags(state: DemoState | null, tables: Seed, now: Date): DemoFlags {
  return {
    state,
    loading: isLoadingDemo(state),
    offline: state === "offline",
    outbox: demoOutbox(state, tables, now),
  };
}

/** Instant `minutes` before `now`. */
const before = (now: Date, minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

/** The fixed outbox for `waiting` (3 waiting), `attention` (1 rejected) and `mixed` (one in each group); empty otherwise. */
export function demoOutbox(state: DemoState | null, tables: Seed, now: Date): OutboxItem[] {
  if (state !== "waiting" && state !== "attention" && state !== "mixed") return [];
  const today = todayIn(tables.workspace.timezone, now);
  const name = (rows: { id: Id; name?: string; nickname?: string }[], id: Id) => {
    const row = rows.find((r) => r.id === id);
    return row ? (row.nickname ?? row.name ?? null) : null;
  };
  const { meta } = tables;
  const crewName = (id: Id) => name(tables.crewMembers, id) ?? "Crew member";
  const projectName = (id: Id) => name(tables.projects, id);
  const stageName = (id: Id) => name(tables.stages, id);

  const smith = meta.projects.smith;
  const sheet = meta.stages.smithSheetInstall;
  const pair = [meta.crew.sam, meta.crew.dima];
  const crewDay = (id: string, minutes: number, date = today): OutboxEntry => ({
    id,
    type: "crew_day",
    createdAt: before(now, minutes),
    input: {
      date,
      projectId: smith,
      stageId: sheet,
      // As the grid builds them on the Smith sheet install: Sam by the day, Dima paid from progress.
      entries: [
        { crewMemberId: meta.crew.sam, basis: "daily", days: 100, hours: 800, multiplier: null },
        { crewMemberId: meta.crew.dima, basis: "time_only", days: null, hours: 800, multiplier: null },
      ],
    },
  });
  const progress = (id: string, minutes: number): OutboxEntry => ({
    id,
    type: "progress",
    createdAt: before(now, minutes),
    input: {
      stageId: sheet,
      date: today,
      quantity: 4000,
      crewMemberIds: pair,
      shares: { mode: "equal" },
      photoFileId: null,
      note: null,
    },
  });
  const noWork = (id: string, minutes: number): OutboxEntry => ({
    id,
    type: "no_work",
    createdAt: before(now, minutes),
    input: { crewMemberIds: [meta.crew.jake], date: today, reason: "rain", note: null },
  });

  const item = (entry: OutboxEntry, itemState: OutboxItem["state"], crewIds: Id[], date = today): OutboxItem => ({
    entry,
    state: itemState,
    date,
    projectName: entry.type === "no_work" ? null : projectName(smith),
    stageName: entry.type === "no_work" ? null : stageName(sheet),
    unit: entry.type === "progress" ? (tables.stages.find((st) => st.id === sheet)?.unit ?? null) : null,
    crewNames: crewIds.map(crewName),
    rejection: null,
  });
  const attention = (): OutboxItem => ({
    ...item(crewDay("01923b6a-7a00-7c3e-9d1f-4b2a6c8e0f01", 95), "needs_attention", pair),
    rejection: {
      code: "forbidden",
      message: "You don't have access to this job any more. Ask your manager.",
      managerMessage: `${projectName(smith)?.split(" — ")[0]} was archived. Pick another job.`,
    },
  });

  if (state === "attention") return [attention()];
  if (state === "mixed") {
    const yesterday = addDays(today, -1);
    return [
      attention(),
      item(progress("01923b6a-7a00-7c3e-9d1f-4b2a6c8e0f22", 2), "sending", pair),
      item(noWork("01923b6a-7a00-7c3e-9d1f-4b2a6c8e0f23", 10), "waiting", [meta.crew.jake]),
      item(crewDay("01923b6a-7a00-7c3e-9d1f-4b2a6c8e0f24", 26 * 60, yesterday), "sent", pair, yesterday),
    ];
  }
  return [
    item(crewDay("01923b6a-7a00-7c3e-9d1f-4b2a6c8e0f11", 30), "waiting", pair),
    item(progress("01923b6a-7a00-7c3e-9d1f-4b2a6c8e0f12", 20), "waiting", pair),
    item(noWork("01923b6a-7a00-7c3e-9d1f-4b2a6c8e0f13", 10), "waiting", [meta.crew.jake]),
  ];
}
