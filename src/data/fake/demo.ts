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
 */
import { todayIn } from "@/domain/dates";
import type { DemoState, Id, OutboxEntry, OutboxItem } from "../contracts";
import type { Seed } from "./seed";

export const DEMO_STATES: readonly DemoState[] = [
  "empty",
  "loading",
  "error",
  "offline",
  "waiting",
  "attention",
  "noperm",
  "blocked",
];

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

/** The fixed outbox for `waiting` (3 waiting) and `attention` (1 rejected); empty otherwise. */
export function demoOutbox(state: DemoState | null, tables: Seed, now: Date): OutboxItem[] {
  if (state !== "waiting" && state !== "attention") return [];
  const today = todayIn(tables.workspace.timezone, now);
  const name = (rows: { id: Id; name?: string; nickname?: string }[], id: Id) => {
    const row = rows.find((r) => r.id === id);
    return row ? (row.nickname ?? row.name ?? null) : null;
  };
  const { meta } = tables;
  const crewName = (id: Id) => name(tables.crewMembers, id) ?? "Crew member";
  const projectName = (id: Id) => name(tables.projects, id);
  const stageName = (id: Id) => name(tables.stages, id);

  if (state === "attention") {
    const entry: OutboxEntry = {
      id: "01923b6a-7a00-7c3e-9d1f-4b2a6c8e0f01",
      type: "crew_day",
      createdAt: before(now, 95),
      input: {
        date: today,
        projectId: meta.projects.smith,
        stageId: meta.stages.smithSheetInstall,
        entries: [
          { crewMemberId: meta.crew.sam, basis: "time_only", days: null, hours: 800, multiplier: null },
          { crewMemberId: meta.crew.dima, basis: "time_only", days: null, hours: 800, multiplier: null },
        ],
      },
    };
    return [
      {
        entry,
        state: "needs_attention",
        date: today,
        projectName: projectName(meta.projects.smith),
        stageName: stageName(meta.stages.smithSheetInstall),
        crewNames: [crewName(meta.crew.sam), crewName(meta.crew.dima)],
        rejection: {
          code: "forbidden",
          message: "You don't have access to this job any more. Ask your manager.",
        },
      },
    ];
  }

  const smith = meta.projects.smith;
  const sheet = meta.stages.smithSheetInstall;
  const items: [OutboxEntry, Id[]][] = [
    [
      {
        id: "01923b6a-7a00-7c3e-9d1f-4b2a6c8e0f11",
        type: "crew_day",
        createdAt: before(now, 30),
        input: {
          date: today,
          projectId: smith,
          stageId: sheet,
          entries: [
            { crewMemberId: meta.crew.sam, basis: "time_only", days: null, hours: 800, multiplier: null },
            { crewMemberId: meta.crew.dima, basis: "time_only", days: null, hours: 800, multiplier: null },
          ],
        },
      },
      [meta.crew.sam, meta.crew.dima],
    ],
    [
      {
        id: "01923b6a-7a00-7c3e-9d1f-4b2a6c8e0f12",
        type: "progress",
        createdAt: before(now, 20),
        input: {
          stageId: sheet,
          date: today,
          quantity: 4000,
          crewMemberIds: [meta.crew.sam, meta.crew.dima],
          shares: { mode: "equal" },
          photoFileId: null,
          note: null,
        },
      },
      [meta.crew.sam, meta.crew.dima],
    ],
    [
      {
        id: "01923b6a-7a00-7c3e-9d1f-4b2a6c8e0f13",
        type: "no_work",
        createdAt: before(now, 10),
        input: { crewMemberIds: [meta.crew.jake], date: today, reason: "rain", note: null },
      },
      [meta.crew.jake],
    ],
  ];
  return items.map(([entry, crewIds]) => ({
    entry,
    state: "waiting",
    date: today,
    projectName: entry.type === "no_work" ? null : projectName(smith),
    stageName: entry.type === "no_work" ? null : stageName(sheet),
    crewNames: crewIds.map(crewName),
    rejection: null,
  }));
}
