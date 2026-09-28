/**
 * The deterministic fake seed: "Harbour Roofing" as of Mon 28 Sep 2026, 7 a.m. Sydney.
 *
 * Pure and fast: no clock, no env, no IO — the same rows every build (seeded PRNG). Every amount is
 * computed with `src/domain` (rates resolved with `resolveRate` and snapshotted on each log).
 *
 * Timeline
 * - 2 Sep 2024 – 14 Aug 2026: generated history (three teams, ~100 completed jobs; `seed-history.ts`).
 * - 17 Aug – 25 Sep 2026: a hand-written roster (`ROSTER`) for the 7 named jobs below.
 * - Pay runs: weekly (Mon–Sun), approved every Monday 08:30 for 2 Sep 2024 … 14–20 Sep 2026 (all
 *   exported except the last). Last week (21–27 Sep) is the **draft to review** on Monday morning;
 *   this week (28 Sep – 4 Oct) is an empty draft. Build the current week's draft only from logs dated
 *   in it until last week's is approved (see `buildPayRun`'s precondition).
 *
 * Scenarios (see `SCENARIOS` in the meta for the list shown to later tasks):
 * - E12.1 Smith job — Ryde re-roof · Sheet install: 400 m², 120 m² (30%), labour $1,432.50,
 *   budget $4,000.00 → forecast $4,775.00, trending over by $775.00 (E4.1 split Sam/Dima, E11.1).
 * - E12.2 Ryde heritage · Repairs & replacements: manual 50%, $900.00 of $1,500.00 → trending $300.00.
 * - E12.3 Wong job · Clean-up: no unit, no %, $1,600.00 of $1,500.00 → over by $100.00 (red).
 * - Ryde heritage · Coat / paint: paused waiting on materials since Mon 14 Sep (> 5 working days).
 * - E13.1 Patel job · Sheet install: 7–9 Sep, weather 10–14 Sep, done 17 Sep → 6 real days, 3 lost.
 * - E5.1 Harris job · Ridge bedding & pointing: $2,000.00 lump sum, logged by Sam, Tom, Dima — ready
 *   for Done. Brown job (complete) has a lump-sum ridge stage already paid.
 * - E1.1/E1.2 Sam: daily $300 from 1 Jul, $320 from 15 Sep; Ryde heritage override $360 from 1 Sep.
 * - Last week's draft: E4.3 Jake 20 lm with no lm rate (missing rate, blocks approval); E10.1 Tom
 *   below floor ($30.00/h, short $32.03); Lee double pay on Wed 23 Sep (daily + lm on Patel
 *   flashings); Ben's late entry for Mon 14 Sep; E8.1 Jake's adjustment +0.5 h (+$12.00) for Thu
 *   17 Sep; E6.1/E7.1 Dima $1,520.00 + GST $152.00 + $110.00 screws reimbursement = $1,782.00;
 *   E14.1 gaps Jake Fri (rain Thu), Ravi Fri, Nick Thu–Fri.
 * - Ledger: E15.1 Dima's $300.00 advance on Mon 21 Sep (balance −$300.00; $1,482.00 once last week
 *   is approved). Kev hasn't been paid since the run approved 7 Sep → unpaid too long.
 * - Kelly job is on hold (repairs paused waiting on the client since 24 Aug); Brown job is complete.
 * - The foreman (Craig) is assigned to the Smith and Patel jobs; Pete left on 30 Jun 2026.
 */
import { createHash } from "node:crypto";
import { adjustmentDelta } from "@/domain/adjustments";
import type { NoWorkReason } from "@/domain/attendance";
import { addDays, dayOfWeek } from "@/domain/dates";
import { hourlyAmount } from "@/domain/lines";
import type { PauseReason } from "@/domain/segments";
import type { Shares } from "@/domain/split";
import type { Cents, Hundredths, LocalDate, RateBasis, Unit } from "@/domain/types";
import type { Id, JobType, ProjectStatus, Role } from "../contracts";
import { DEFAULT_FAKE_NOW } from "./clock";
import type { ProjectRow, SeedTables, StageRow, WorkLogRow } from "./rows";
import { SeedBuilder, STANDARD_DAY, TIMEZONE, type GridSpec, type TemplateItemDef } from "./seed-builder";
import { generateHistory } from "./seed-history";

export const SEED_TODAY: LocalDate = "2026-09-28";
export const SEED_NOW = new Date(DEFAULT_FAKE_NOW).toISOString();
const HISTORY_START: LocalDate = "2024-09-02";
const HISTORY_CUTOFF: LocalDate = "2026-08-14";
const ROSTER_START: LocalDate = "2026-08-17";
const LATE_ENTERED_AT: LocalDate = "2026-09-22";

export type CrewKey =
  "sam" | "tom" | "jake" | "dima" | "lee" | "mick" | "kev" | "ravi" | "josh" | "ben" | "pete" | "nick";
export type ProjectKey = "smith" | "patel" | "rydeHeritage" | "harris" | "wong" | "brown" | "kelly";

export interface SeedMeta {
  today: LocalDate;
  now: string;
  historyStart: LocalDate;
  timezone: string;
  users: Record<Role, Id>;
  members: Record<Role, Id>;
  crew: Record<CrewKey, Id>;
  projects: Record<ProjectKey, Id>;
  stages: {
    smithSheetInstall: Id;
    patelSheetInstall: Id;
    patelFlashings: Id;
    rydeRepairs: Id;
    rydeRebed: Id;
    rydeCoat: Id;
    harrisTile: Id;
    harrisRidge: Id;
    wongCleanUp: Id;
    brownRidge: Id;
    kellyRepairs: Id;
  };
  payRuns: { review: Id; current: Id; lastApproved: Id };
  logs: { lateEntry: Id; adjustment: Id; adjustedOriginal: Id };
  expenses: { dimaScrews: Id; smithSheets: Id };
  statementTokens: { payRunId: Id; crewMemberId: Id; token: string }[];
  scenarios: string[];
}

export interface Seed extends SeedTables {
  meta: SeedMeta;
}

// ─── Reference data ─────────────────────────────────────────────────────────

const LEVELS: [string, Cents][] = [
  ["Labourer", 2800],
  ["Apprentice yr 1", 1800],
  ["Apprentice yr 2", 2200],
  ["Apprentice yr 3", 2500],
  ["Apprentice yr 4", 2800],
  ["Roofer", 3200],
  ["Leading hand", 3600],
  ["Foreman", 4000],
];

const CATEGORIES = [
  "Materials",
  "Equipment hire",
  "Scaffolding",
  "Skip/tip fees",
  "Fuel & travel",
  "Parking & tolls",
  "Subcontractor (non-crew)",
  "Permits",
  "Other",
];

const item = (
  name: string,
  unit: Unit | null,
  labourShareBp: number,
  materialsShareBp: number,
): TemplateItemDef => ({
  name,
  unit,
  labourShareBp,
  materialsShareBp,
});

export const TEMPLATES: Record<JobType, { name: string; items: TemplateItemDef[] }> = {
  metal_reroof: {
    name: "Metal re-roof",
    items: [
      item("Site setup & safety", null, 500, 0),
      item("Strip & remove", null, 1500, 0),
      item("Battens / structural repairs", null, 1500, 1000),
      item("Sarking & insulation", null, 1000, 1500),
      item("Sheet install", "m2", 3500, 6500),
      item("Flashings, gutters & downpipes", "lm", 1500, 1000),
      item("Clean-up & handover", null, 500, 0),
    ],
  },
  tile_reroof: {
    name: "Tile re-roof",
    items: [
      item("Site setup & safety", null, 500, 0),
      item("Strip & remove", null, 1500, 0),
      item("Battens", null, 1500, 1000),
      item("Sarking", null, 1000, 1000),
      item("Tile install", "m2", 3500, 7000),
      item("Ridge bedding & pointing", null, 1500, 1000),
      item("Clean-up & handover", null, 500, 0),
    ],
  },
  restoration: {
    name: "Restoration",
    items: [
      item("Site setup", null, 500, 0),
      item("Pressure clean", "m2", 1500, 0),
      item("Repairs & replacements", null, 2000, 2500),
      item("Re-bed & re-point", null, 2500, 2500),
      item("Coat / paint", "m2", 3000, 5000),
      item("Clean-up", null, 500, 0),
    ],
  },
  repair: {
    name: "Repair",
    items: [
      item("Inspect", null, 1500, 0),
      item("Repair", null, 7000, 10000),
      item("Clean-up", null, 1500, 0),
    ],
  },
  new_build: {
    name: "New build",
    items: [
      item("Battens", null, 2000, 1500),
      item("Sarking & insulation", null, 1500, 1500),
      item("Roof sheeting/tiles", "m2", 3500, 5000),
      item("Flashings", "lm", 1500, 1000),
      item("Gutters & downpipes", "lm", 1500, 1000),
    ],
  },
};

interface CrewDef {
  key: CrewKey;
  name: string;
  phone: string;
  type: "employee" | "contractor";
  level: string | null;
  abn: string | null;
  gst: boolean;
  from: LocalDate;
  to: LocalDate | null;
  basis: RateBasis;
  unit: Unit | null;
  rates: [RateBasis, Unit | null, [LocalDate, Cents][]][];
}

/** Pay rules §0 crew (Sam, Tom, Jake, Dima, Lee) plus seven. Current rates match §0 exactly. */
const CREW: CrewDef[] = [
  {
    key: "sam",
    name: "Sam",
    phone: "0412 334 101",
    type: "employee",
    level: "Roofer",
    abn: null,
    gst: false,
    from: HISTORY_START,
    to: null,
    basis: "daily",
    unit: null,
    rates: [
      [
        "daily",
        null,
        [
          [HISTORY_START, 28000],
          ["2026-07-01", 30000],
          ["2026-09-15", 32000],
        ],
      ],
      [
        "per_unit",
        "m2",
        [
          [HISTORY_START, 900],
          ["2025-07-01", 950],
        ],
      ],
      [
        "hourly",
        null,
        [
          [HISTORY_START, 3800],
          ["2025-07-01", 4000],
        ],
      ],
    ],
  },
  {
    key: "tom",
    name: "Tom",
    phone: "0412 334 102",
    type: "employee",
    level: "Roofer",
    abn: null,
    gst: false,
    from: HISTORY_START,
    to: null,
    basis: "per_unit",
    unit: "m2",
    rates: [
      [
        "per_unit",
        "m2",
        [
          [HISTORY_START, 850],
          ["2025-07-01", 900],
        ],
      ],
      [
        "daily",
        null,
        [
          [HISTORY_START, 28000],
          ["2025-07-01", 30000],
        ],
      ],
    ],
  },
  {
    key: "jake",
    name: "Jake",
    phone: "0412 334 103",
    type: "employee",
    level: "Apprentice yr 2",
    abn: null,
    gst: false,
    from: HISTORY_START,
    to: null,
    basis: "hourly",
    unit: null,
    rates: [
      [
        "hourly",
        null,
        [
          [HISTORY_START, 2200],
          ["2026-01-05", 2400],
        ],
      ],
    ],
  },
  {
    key: "dima",
    name: "Dima",
    phone: "0412 334 104",
    type: "contractor",
    level: null,
    abn: "21 435 133 679",
    gst: true,
    from: HISTORY_START,
    to: null,
    basis: "per_unit",
    unit: "m2",
    rates: [
      [
        "per_unit",
        "m2",
        [
          [HISTORY_START, 1150],
          ["2025-07-01", 1200],
        ],
      ],
      [
        "daily",
        null,
        [
          [HISTORY_START, 38000],
          ["2025-07-01", 40000],
        ],
      ],
    ],
  },
  {
    key: "lee",
    name: "Lee",
    phone: "0412 334 105",
    type: "contractor",
    level: null,
    abn: "62 123 212 675",
    gst: false,
    from: HISTORY_START,
    to: null,
    basis: "daily",
    unit: null,
    rates: [
      ["per_unit", "lm", [[HISTORY_START, 800]]],
      [
        "daily",
        null,
        [
          [HISTORY_START, 33000],
          ["2025-07-01", 35000],
        ],
      ],
    ],
  },
  {
    key: "mick",
    name: "Mick",
    phone: "0412 334 106",
    type: "employee",
    level: "Leading hand",
    abn: null,
    gst: false,
    from: HISTORY_START,
    to: null,
    basis: "daily",
    unit: null,
    rates: [
      [
        "daily",
        null,
        [
          [HISTORY_START, 34000],
          ["2025-07-01", 36000],
        ],
      ],
      ["hourly", null, [[HISTORY_START, 4500]]],
    ],
  },
  {
    key: "kev",
    name: "Kev",
    phone: "0412 334 107",
    type: "contractor",
    level: null,
    abn: "98 342 383 631",
    gst: true,
    from: HISTORY_START,
    to: null,
    basis: "per_unit",
    unit: "m2",
    rates: [
      ["per_unit", "m2", [[HISTORY_START, 1100]]],
      ["daily", null, [[HISTORY_START, 40000]]],
    ],
  },
  {
    key: "ravi",
    name: "Ravi",
    phone: "0412 334 108",
    type: "employee",
    level: "Labourer",
    abn: null,
    gst: false,
    from: HISTORY_START,
    to: null,
    basis: "hourly",
    unit: null,
    rates: [
      [
        "hourly",
        null,
        [
          [HISTORY_START, 3000],
          ["2025-07-01", 3200],
        ],
      ],
    ],
  },
  {
    key: "josh",
    name: "Josh",
    phone: "0412 334 109",
    type: "employee",
    level: "Apprentice yr 3",
    abn: null,
    gst: false,
    from: HISTORY_START,
    to: null,
    basis: "hourly",
    unit: null,
    rates: [
      [
        "hourly",
        null,
        [
          [HISTORY_START, 2500],
          ["2025-07-01", 2700],
        ],
      ],
    ],
  },
  {
    key: "ben",
    name: "Ben",
    phone: "0412 334 110",
    type: "employee",
    level: "Apprentice yr 1",
    abn: null,
    gst: false,
    from: "2026-02-02",
    to: null,
    basis: "hourly",
    unit: null,
    rates: [["hourly", null, [["2026-02-02", 2000]]]],
  },
  {
    key: "pete",
    name: "Pete",
    phone: "0412 334 111",
    type: "employee",
    level: "Roofer",
    abn: null,
    gst: false,
    from: HISTORY_START,
    to: "2026-06-30",
    basis: "daily",
    unit: null,
    rates: [["daily", null, [[HISTORY_START, 29000]]]],
  },
  {
    key: "nick",
    name: "Nick",
    phone: "0412 334 112",
    type: "contractor",
    level: null,
    abn: "30 833 903 811",
    gst: false,
    from: "2025-03-03",
    to: null,
    basis: "daily",
    unit: null,
    rates: [["daily", null, [["2025-03-03", 38000]]]],
  },
];

// ─── The scripted weeks (17 Aug – 25 Sep 2026) ──────────────────────────────

interface ScriptedStage {
  budgetQty?: Hundredths;
  labourBudgetCents?: Cents;
  lumpSumCents?: Cents;
  manualPctBp?: number;
  doneOn?: LocalDate;
}

interface ScriptedProject {
  key: ProjectKey;
  code: string;
  client: { name: string; phone: string; email: string };
  nickname: string;
  siteAddress: string;
  jobType: JobType;
  status: ProjectStatus;
  createdOn: LocalDate;
  targetFinish: LocalDate;
  foreman: boolean;
  stages: Record<number, ScriptedStage>;
}

const PROJECTS: ScriptedProject[] = [
  {
    key: "smith",
    code: "S",
    nickname: "Smith job — Ryde re-roof",
    jobType: "metal_reroof",
    status: "active",
    client: { name: "Mark Smith", phone: "0413 555 201", email: "mark.smith@example.com" },
    siteAddress: "14 Pope St, Ryde NSW 2112",
    createdOn: "2026-08-10",
    targetFinish: "2026-10-09",
    foreman: true,
    stages: {
      1: { doneOn: "2026-08-31" },
      2: { doneOn: "2026-09-03" },
      3: { doneOn: "2026-09-15" },
      4: { doneOn: "2026-09-22" },
      5: { budgetQty: 40000, labourBudgetCents: 400000 },
      6: { budgetQty: 16000 },
    },
  },
  {
    key: "patel",
    code: "P",
    nickname: "Patel job — Epping re-roof",
    jobType: "metal_reroof",
    status: "active",
    client: { name: "Anita Patel", phone: "0413 555 202", email: "anita.patel@example.com" },
    siteAddress: "7 Carlingford Rd, Epping NSW 2121",
    createdOn: "2026-08-03",
    targetFinish: "2026-10-02",
    foreman: true,
    stages: {
      1: { doneOn: "2026-08-17" },
      2: { doneOn: "2026-08-21" },
      3: { doneOn: "2026-08-28" },
      4: { doneOn: "2026-09-04" },
      5: { budgetQty: 38000, doneOn: "2026-09-17" },
      6: { budgetQty: 18000 },
    },
  },
  {
    key: "rydeHeritage",
    code: "Y",
    nickname: "Ryde heritage",
    jobType: "restoration",
    status: "active",
    client: { name: "Helen Jones", phone: "0413 555 203", email: "helen.jones@example.com" },
    siteAddress: "3 Belmore St, Ryde NSW 2112",
    createdOn: "2026-08-12",
    targetFinish: "2026-10-16",
    foreman: false,
    stages: {
      1: { doneOn: "2026-08-24" },
      2: { doneOn: "2026-08-28" },
      3: { labourBudgetCents: 150000, manualPctBp: 5000 },
      5: { budgetQty: 26000 },
    },
  },
  {
    key: "harris",
    code: "H",
    nickname: "Harris job — Balmain tile re-roof",
    jobType: "tile_reroof",
    status: "active",
    client: { name: "Tony Harris", phone: "0413 555 204", email: "tony.harris@example.com" },
    siteAddress: "22 Darling St, Balmain NSW 2041",
    createdOn: "2026-08-24",
    targetFinish: "2026-10-09",
    foreman: false,
    stages: {
      1: { doneOn: "2026-09-07" },
      2: { doneOn: "2026-09-09" },
      3: { doneOn: "2026-09-11" },
      4: { doneOn: "2026-09-15" },
      5: { budgetQty: 52000 },
      6: { lumpSumCents: 200000, labourBudgetCents: 280000 },
    },
  },
  {
    key: "wong",
    code: "W",
    nickname: "Wong job — Chatswood leak repair",
    jobType: "repair",
    status: "active",
    client: { name: "Grace Wong", phone: "0413 555 205", email: "grace.wong@example.com" },
    siteAddress: "41 Albert Ave, Chatswood NSW 2067",
    createdOn: "2026-09-08",
    targetFinish: "2026-09-25",
    foreman: false,
    stages: { 1: { doneOn: "2026-09-14" }, 2: { doneOn: "2026-09-18" }, 3: { labourBudgetCents: 150000 } },
  },
  {
    key: "brown",
    code: "B",
    nickname: "Brown job — Mosman tile re-roof",
    jobType: "tile_reroof",
    status: "complete",
    client: { name: "Peter Brown", phone: "0413 555 206", email: "peter.brown@example.com" },
    siteAddress: "9 Raglan St, Mosman NSW 2088",
    createdOn: "2026-07-27",
    targetFinish: "2026-09-04",
    foreman: false,
    stages: {
      1: { doneOn: "2026-08-17" },
      2: { doneOn: "2026-08-19" },
      3: { doneOn: "2026-08-21" },
      4: { doneOn: "2026-08-25" },
      5: { budgetQty: 21000, doneOn: "2026-09-01" },
      6: { lumpSumCents: 180000, doneOn: "2026-09-03" },
      7: { doneOn: "2026-09-04" },
    },
  },
  {
    key: "kelly",
    code: "K",
    nickname: "Kelly job — Manly restoration",
    jobType: "restoration",
    status: "on_hold",
    client: { name: "Sue Kelly", phone: "0413 555 207", email: "sue.kelly@example.com" },
    siteAddress: "5 Addison Rd, Manly NSW 2095",
    createdOn: "2026-08-05",
    targetFinish: "2026-09-11",
    foreman: false,
    stages: { 1: { doneOn: "2026-08-17" }, 2: { doneOn: "2026-08-20" } },
  },
];

/**
 * Who worked where, Mon–Fri, 17 Aug – 25 Sep (six weeks, "|" between weeks). A token is
 * `<job code><stage position>` with optional `t` (time-only), `L` (entered late, on 22 Sep) and
 * `h<hundredths>` (hours). `r-` rain, `l-` leave, `s-` sick, `..` nothing (a gap unless a progress
 * entry covers the day), `--` not employed.
 */
const ROSTER: Record<CrewKey, string> = {
  sam: "P1 P2 P2 P2 P2 | P3 P3 P3 P3 P3 | P4 P4 Y4 Y4 Y4 | Y4 Y4 Y4 Y4 Y4 | Y4 Y4 Y4 Y4 H6 | Y4 Y4 S5t S5t S5t",
  tom: "P1 P2 P2 P2 P2 | P3 P3 P3 P3 P3 | P4 P4 P4 P4 P4 | P5 P5 P5 r- r- | r- P5 P5 P5 H6 | H5 H5 l- l- l-",
  jake: "P1 P2 P2 P2 P2 | P3 P3 P3 P3 P3 | S1 S2 S2 S2 S3 | S3 S3 S3 S3 S3 | S3 S3 S4 S4h750 S4 | S4 S4 .. r- ..",
  dima: "P1 P2 P2 P2 P2 | P3 P3 P3 P3 P3 | P4 P4 P4 P4 P4 | H1 H2 H2 H3 H3 | H4 H4 H5 H5 H6 | Y4 Y4 S5 S5 S5",
  lee: "P1 P2 P2 P2 P2 | P3 P3 P3 P3 P3 | P4 P4 P4 P4 P4 | P5 P5 P5 r- r- | r- P5 P5 P5 P6 | P6 P6 P6 P6 P6",
  mick: "B1 B2 B2 B3 B3 | B4 B4 B5 B5 B5 | Y3 Y3 B6 B6 B7 | H1 H2 H2 H3 H3 | H4 H4 H5 H5 H5 | H5 H5 H5 H5 H5",
  kev: "B1 B2 B2 B3 B3 | B4 B4 B5 B5 B5 | B5 B5 B6 B6 B7 | H1 H2 H2 H3 H3 | H4 H4 H5 H5 H5 | H5 H5 H5 H5 H5",
  ravi: "K1 K2 K2 K2 K3 | Y1 Y2 Y2 Y2 Y2 | S1 S2 S2 S2 S3 | S3 S3 S3 S3 S3 | W1 W2 W2 W2 W2 | W3h1000 W3h1000 W3h1000 W3h1000 ..",
  josh: "B1 B2 B2 B3 B3 | B4 B4 B5 B5 B5 | B5 B5 B6 B6 B7 | S3 S3 Y5 Y5 Y5 | S3 S3 S4 S4 S4 | S4 S4 H5 H5 H5",
  ben: "B1 B2 B2 B3 B3 | B4 B4 B5 B5 B5 | S1 S2 S2 S2 S3 | S3 S3 S3 S3 S3 | S3L W2 W2 W2 W2 | S4 S4 H5 H5 s-",
  pete: "-- -- -- -- -- | -- -- -- -- -- | -- -- -- -- -- | -- -- -- -- -- | -- -- -- -- -- | -- -- -- -- --",
  nick: "K1 K2 K2 K2 K3 | Y1 Y2 Y2 Y2 Y2 | S1 S2 Y4 Y4 Y4 | Y4 Y4 Y4 Y4 Y4 | Y4 Y4 Y4 Y4 Y4 | Y4 Y4 Y4 .. ..",
};

interface ProgressDef {
  date: LocalDate;
  stage: string;
  crew: CrewKey[];
  quantity: Hundredths;
  shares?: Shares;
}

const PROGRESS: ProgressDef[] = [
  { date: "2026-08-26", stage: "B5", crew: ["kev"], quantity: 4500 },
  { date: "2026-08-27", stage: "B5", crew: ["kev"], quantity: 4200 },
  { date: "2026-08-28", stage: "B5", crew: ["kev"], quantity: 4400 },
  { date: "2026-08-31", stage: "B5", crew: ["kev"], quantity: 4000 },
  { date: "2026-09-01", stage: "B5", crew: ["kev"], quantity: 3800 },
  { date: "2026-09-09", stage: "P5", crew: ["tom"], quantity: 18000 },
  { date: "2026-09-17", stage: "P5", crew: ["tom"], quantity: 20000 },
  { date: "2026-09-16", stage: "H5", crew: ["kev", "dima"], quantity: 6000 },
  { date: "2026-09-17", stage: "H5", crew: ["kev", "dima"], quantity: 7000 },
  { date: "2026-09-18", stage: "H5", crew: ["kev"], quantity: 3600 },
  { date: "2026-09-21", stage: "H5", crew: ["kev", "tom"], quantity: 6666 },
  { date: "2026-09-22", stage: "H5", crew: ["kev", "tom"], quantity: 4000 },
  { date: "2026-09-23", stage: "H5", crew: ["kev"], quantity: 3600 },
  { date: "2026-09-24", stage: "H5", crew: ["kev"], quantity: 3800 },
  { date: "2026-09-25", stage: "H5", crew: ["kev"], quantity: 3500 },
  // E4.3: 80 lm gutters, Lee 75% / Jake 25%; Jake has no lm rate.
  {
    date: "2026-09-23",
    stage: "P6",
    crew: ["lee", "jake"],
    quantity: 8000,
    shares: { mode: "custom", bp: [7500, 2500] },
  },
  // E4.1 / E12.1: 120 m² sheet install, Sam and Dima equal.
  { date: "2026-09-25", stage: "S5", crew: ["sam", "dima"], quantity: 12000 },
];

const PAUSES: {
  date: LocalDate;
  stage: string;
  reason: PauseReason;
  note: string | null;
  resume?: LocalDate;
}[] = [
  { date: "2026-08-24", stage: "K3", reason: "client", note: "Owner deciding on the heritage tile colour" },
  { date: "2026-09-10", stage: "P5", reason: "weather", note: "Rain", resume: "2026-09-15" },
  { date: "2026-09-14", stage: "Y5", reason: "materials", note: "Waiting on the heritage paint order" },
];

interface ExpenseDef {
  date: LocalDate;
  stage: string;
  category: string;
  supplier: string;
  totalCents: Cents;
  paidBy?: "company_card" | "cash" | "crew";
  crew?: CrewKey;
  /** Project-level expense (no stage). */
  projectOnly?: boolean;
}

const EXPENSES: ExpenseDef[] = [
  {
    date: "2026-08-17",
    stage: "B1",
    category: "Scaffolding",
    supplier: "Ace Scaffold Hire",
    totalCents: 176000,
    projectOnly: true,
  },
  { date: "2026-08-18", stage: "B2", category: "Skip/tip fees", supplier: "Bin It Skips", totalCents: 77000 },
  {
    date: "2026-08-20",
    stage: "B3",
    category: "Materials",
    supplier: "Northside Timber",
    totalCents: 143000,
  },
  {
    date: "2026-08-26",
    stage: "B5",
    category: "Materials",
    supplier: "Coastal Tile Co",
    totalCents: 1045000,
  },
  { date: "2026-09-02", stage: "B6", category: "Materials", supplier: "RoofMart", totalCents: 33000 },
  {
    date: "2026-08-18",
    stage: "K2",
    category: "Equipment hire",
    supplier: "Pressure Pro Hire",
    totalCents: 33000,
  },
  {
    date: "2026-08-17",
    stage: "P1",
    category: "Scaffolding",
    supplier: "Ace Scaffold Hire",
    totalCents: 154000,
    projectOnly: true,
  },
  { date: "2026-08-18", stage: "P2", category: "Skip/tip fees", supplier: "Bin It Skips", totalCents: 66000 },
  {
    date: "2026-08-24",
    stage: "P3",
    category: "Materials",
    supplier: "Northside Timber",
    totalCents: 121000,
  },
  {
    date: "2026-09-07",
    stage: "P5",
    category: "Materials",
    supplier: "Harbour Steel Supply",
    totalCents: 880000,
  },
  {
    date: "2026-09-18",
    stage: "P6",
    category: "Materials",
    supplier: "Gutter Supplies Co",
    totalCents: 242000,
  },
  {
    date: "2026-08-24",
    stage: "Y1",
    category: "Scaffolding",
    supplier: "Ace Scaffold Hire",
    totalCents: 198000,
    projectOnly: true,
  },
  { date: "2026-08-31", stage: "Y3", category: "Materials", supplier: "RoofMart", totalCents: 88000 },
  { date: "2026-09-02", stage: "Y4", category: "Materials", supplier: "RoofMart", totalCents: 55000 },
  { date: "2026-09-09", stage: "Y5", category: "Materials", supplier: "Paint Depot", totalCents: 66000 },
  {
    date: "2026-09-07",
    stage: "H1",
    category: "Scaffolding",
    supplier: "Ace Scaffold Hire",
    totalCents: 176000,
    projectOnly: true,
  },
  { date: "2026-09-08", stage: "H2", category: "Skip/tip fees", supplier: "Bin It Skips", totalCents: 71500 },
  {
    date: "2026-09-10",
    stage: "H3",
    category: "Materials",
    supplier: "Northside Timber",
    totalCents: 165000,
  },
  {
    date: "2026-09-16",
    stage: "H5",
    category: "Materials",
    supplier: "Coastal Tile Co",
    totalCents: 1210000,
  },
  { date: "2026-09-15", stage: "W2", category: "Materials", supplier: "RoofMart", totalCents: 49500 },
  {
    date: "2026-09-15",
    stage: "W2",
    category: "Materials",
    supplier: "RoofMart",
    totalCents: 22000,
    paidBy: "cash",
  },
  {
    date: "2026-08-31",
    stage: "S1",
    category: "Scaffolding",
    supplier: "Ace Scaffold Hire",
    totalCents: 165000,
    projectOnly: true,
  },
  { date: "2026-09-01", stage: "S2", category: "Skip/tip fees", supplier: "Bin It Skips", totalCents: 77000 },
  {
    date: "2026-09-04",
    stage: "S3",
    category: "Materials",
    supplier: "Northside Timber",
    totalCents: 220000,
  },
  {
    date: "2026-09-16",
    stage: "S4",
    category: "Materials",
    supplier: "Harbour Steel Supply",
    totalCents: 132000,
  },
  {
    date: "2026-09-22",
    stage: "S5",
    category: "Materials",
    supplier: "Harbour Steel Supply",
    totalCents: 990000,
  },
  // E7.1: Dima paid $110.00 (GST $10.00) for screws on Wed → reimbursement in last week's pay run.
  {
    date: "2026-09-23",
    stage: "S5",
    category: "Materials",
    supplier: "Trade Fasteners",
    totalCents: 11000,
    paidBy: "crew",
    crew: "dima",
  },
];

const TOKEN = /^([A-Z])(\d)(t?)(L?)(?:h(\d+))?$/;
const NO_WORK: Record<string, NoWorkReason> = { "r-": "rain", "l-": "leave", "s-": "sick", "o-": "other" };

// ─── Build ──────────────────────────────────────────────────────────────────

export function buildSeed(): Seed {
  const b = new SeedBuilder(
    20260928,
    {
      name: "Harbour Roofing",
      abn: "93 877 909 676",
      gstRegistered: true,
      timezone: TIMEZONE,
      payPeriod: "weekly",
      payWeekStart: 1,
      payAnchor: HISTORY_START,
      workingDays: [1, 2, 3, 4, 5],
      standardDayHours: STANDARD_DAY,
      onCostBp: 2500,
    },
    "2024-08-26",
  );
  const t = b.t;
  const setupAt = b.at("2024-08-26", "09:30");

  // Members (users). Craig is the foreman user; crew are records, not users.
  const people: [Role, string, string, boolean][] = [
    ["owner", "Karen Holt", "karen@harbourroofing.example", true],
    ["manager", "Dan Holt", "dan@harbourroofing.example", false],
    ["foreman", "Craig Dunn", "craig@harbourroofing.example", false],
    ["accountant", "Priya Shah", "priya@ledgerwise.example", false],
  ];
  const users = {} as Record<Role, Id>;
  const members = {} as Record<Role, Id>;
  for (const [role, name, email, twoFactorEnabled] of people) {
    const m = { ...b.base(setupAt), userId: b.id(), name, email, role, twoFactorEnabled };
    t.members.push(m);
    users[role] = m.userId;
    members[role] = m.id;
  }

  LEVELS.forEach(([name, floorRateCents], position) =>
    t.crewLevels.push({ ...b.base(setupAt), name, floorRateCents, position }),
  );
  CATEGORIES.forEach((name, position) => t.expenseCategories.push({ ...b.base(setupAt), name, position }));
  for (const [jobType, tpl] of Object.entries(TEMPLATES) as [JobType, (typeof TEMPLATES)[JobType]][]) {
    const row = { ...b.base(setupAt), jobType, name: tpl.name };
    t.stageTemplates.push(row);
    tpl.items.forEach((it, i) =>
      t.stageTemplateItems.push({
        ...b.base(setupAt),
        templateId: row.id,
        name: it.name,
        position: i + 1,
        defaultUnit: it.unit,
        labourShareBp: it.labourShareBp,
        materialsShareBp: it.materialsShareBp,
      }),
    );
  }

  const crew = {} as Record<CrewKey, Id>;
  for (const c of CREW) {
    const row = b.addCrew({
      name: c.name,
      phone: c.phone,
      type: c.type,
      levelId: c.level ? t.crewLevels.find((lv) => lv.name === c.level)!.id : null,
      abn: c.abn,
      gstRegistered: c.gst,
      activeFrom: c.from,
      activeTo: c.to,
      defaultBasis: c.basis,
      defaultUnit: c.unit,
    });
    crew[c.key] = row.id;
    for (const [basis, unit, steps] of c.rates)
      for (const [from, cents] of steps) b.addRate(row.id, basis, unit, cents, from);
  }

  // Two years of completed jobs.
  const templates = Object.fromEntries(Object.entries(TEMPLATES).map(([k, v]) => [k, v.items])) as Record<
    JobType,
    TemplateItemDef[]
  >;
  generateHistory(b, {
    start: HISTORY_START,
    cutoff: HISTORY_CUTOFF,
    templates,
    enteredBy: users.manager,
    teams: [
      {
        members: [crew.sam, crew.dima, crew.tom, crew.jake, crew.lee],
        jobTypes: ["metal_reroof", "metal_reroof", "new_build"],
      },
      {
        members: [crew.mick, crew.kev, crew.josh, crew.ben],
        jobTypes: ["tile_reroof", "restoration", "tile_reroof"],
      },
      { members: [crew.ravi, crew.pete, crew.nick], jobTypes: ["repair", "restoration", "repair", "repair"] },
    ],
  });

  // The seven named jobs.
  const projects = {} as Record<ProjectKey, Id>;
  const projectRows = new Map<string, ProjectRow>();
  const stageByCode = new Map<string, StageRow>();
  for (const p of PROJECTS) {
    const client = {
      ...b.base(b.at(p.createdOn, "09:00")),
      name: p.client.name,
      phone: p.client.phone,
      email: p.client.email,
      address: p.siteAddress,
    };
    t.clients.push(client);
    const row = b.addProject({
      clientId: client.id,
      nickname: p.nickname,
      siteAddress: p.siteAddress,
      jobType: p.jobType,
      status: p.status,
      createdOn: p.createdOn,
    });
    row.targetFinish = p.targetFinish;
    projects[p.key] = row.id;
    projectRows.set(p.code, row);
    TEMPLATES[p.jobType].items.forEach((it, i) => {
      const s = p.stages[i + 1] ?? {};
      const stage = b.addStage(row, it, i + 1, {
        ...(s.budgetQty !== undefined && { budgetQty: s.budgetQty }),
        ...(s.labourBudgetCents !== undefined && { labourBudgetCents: s.labourBudgetCents }),
        ...(s.lumpSumCents !== undefined && { lumpSumCents: s.lumpSumCents }),
        ...(s.manualPctBp !== undefined && { manualPctBp: s.manualPctBp }),
      });
      stageByCode.set(`${p.code}${i + 1}`, stage);
    });
    if (p.foreman) {
      t.projectAssignments.push({
        ...b.base(b.at(p.createdOn, "09:15")),
        memberId: members.foreman,
        projectId: row.id,
      });
    }
  }
  // E1.2: Sam's Ryde heritage override, in place before any September log is written.
  const override = b.addRate(crew.sam, "daily", null, 36000, "2026-09-01", projects.rydeHeritage);
  const stageOf = (code: string) => stageByCode.get(code) ?? fail(`no stage ${code}`);
  const enteredByFor = (stage: StageRow) =>
    t.projectAssignments.some((a) => a.projectId === stage.projectId) ? users.foreman : users.manager;
  const doneDates = new Map<LocalDate, string[]>();
  for (const p of PROJECTS) {
    for (const [pos, s] of Object.entries(p.stages)) {
      if (s.doneOn) doneDates.set(s.doneOn, [...(doneDates.get(s.doneOn) ?? []), `${p.code}${pos}`]);
    }
  }

  const rosterDays: LocalDate[] = [];
  for (let d = ROSTER_START; rosterDays.length < 30; d = addDays(d, 1))
    if (dayOfWeek(d) >= 1 && dayOfWeek(d) <= 5) rosterDays.push(d);
  const roster = Object.fromEntries(
    (Object.entries(ROSTER) as [CrewKey, string][]).map(([k, line]) => {
      const tokens = line.split("|").flatMap((w) => w.trim().split(/\s+/));
      if (tokens.length !== rosterDays.length) fail(`roster for ${k} has ${tokens.length} days`);
      return [k, tokens];
    }),
  ) as Record<CrewKey, string[]>;

  let lateEntry: WorkLogRow | null = null;
  rosterDays.forEach((date, dayIndex) => {
    for (const p of PAUSES) {
      if (p.resume === date) b.resumeStage(stageOf(p.stage).id, date);
    }
    for (const p of PAUSES) {
      if (p.date === date) b.pauseStage(stageOf(p.stage).id, date, p.reason, p.note);
    }
    const groups = new Map<string, { stage: StageRow; specs: GridSpec[]; late: boolean }>();
    for (const key of Object.keys(ROSTER) as CrewKey[]) {
      const token = roster[key][dayIndex]!;
      if (token === ".." || token === "--") continue;
      const reason = NO_WORK[token];
      if (reason) {
        b.noWork(crew[key], date, reason, {
          enteredBy: users.manager,
          ...(reason === "rain" && { note: "Rained off" }),
        });
        continue;
      }
      const m = TOKEN.exec(token) ?? fail(`bad roster token ${token}`);
      const stage = stageOf(`${m[1]}${m[2]}`);
      const late = m[4] === "L";
      const spec: GridSpec = { crewId: crew[key] };
      if (m[3] === "t") spec.timeOnly = true;
      if (m[5]) spec.hours = Number(m[5]);
      const groupKey = `${stage.id}|${late}`;
      const g = groups.get(groupKey) ?? { stage, specs: [], late };
      g.specs.push(spec);
      groups.set(groupKey, g);
    }
    for (const g of groups.values()) {
      const opts = g.late
        ? { enteredBy: users.manager, createdAt: b.at(LATE_ENTERED_AT, "18:10") }
        : { enteredBy: enteredByFor(g.stage) };
      const logs = b.grid(date, g.stage.id, g.specs, opts);
      if (g.late) lateEntry = logs[0]!;
    }
    for (const p of PROGRESS.filter((x) => x.date === date)) {
      const stage = stageOf(p.stage);
      b.progress(
        date,
        stage.id,
        p.crew.map((k) => crew[k]),
        p.quantity,
        p.shares ?? { mode: "equal" },
        {
          enteredBy: enteredByFor(stage),
        },
      );
    }
    for (const e of EXPENSES.filter((x) => x.date === date)) {
      const stage = stageOf(e.stage);
      b.expense({
        date,
        projectId: stage.projectId,
        stageId: e.projectOnly ? null : stage.id,
        category: e.category,
        supplier: e.supplier,
        totalCents: e.totalCents,
        paidBy: e.paidBy ?? "company_card",
        crewMemberId: e.crew ? crew[e.crew] : null,
        enteredBy: enteredByFor(stage),
      });
    }
    for (const code of doneDates.get(date) ?? []) b.doneStage(stageOf(code).id, date);
  });

  for (const p of PROJECTS) {
    b.finaliseBudgets(projectRows.get(p.code)!, {
      labourFactor: [10_800, 12_500],
      materialsFactor: [10_000, 12_000],
      markupBp: [12_500, 14_000],
    });
  }

  // Pay runs: approve every week up to 14–20 Sep; Kev unpaid since 7 Sep.
  const historyAdvances = Array.from({ length: 14 }, (_, i) => {
    const key = b.rng.pick<CrewKey>(["sam", "tom", "jake", "mick", "ravi", "josh"]);
    const monday = addDays(HISTORY_START, 7 * b.rng.int(2 + i * 6, 6 + i * 6));
    return { crewId: crew[key], date: monday, amountCents: b.rng.int(2, 5) * 10_000, note: "Cash advance" };
  });
  b.approveWeeks({
    firstStart: HISTORY_START,
    lastStart: "2026-09-14",
    approvedBy: users.manager,
    exportAllBut: 1,
    skipPayment: (crewId, approvedOn) => crewId === crew.kev && approvedOn >= "2026-09-07",
    advances: [
      ...historyAdvances,
      { crewId: crew.dima, date: "2026-09-21", amountCents: 30_000, note: "Advance for fuel and fixings" },
    ],
  });
  const lastApproved = t.payRuns.find((r) => r.periodStart === "2026-09-14")!;
  const draftAt = b.at("2026-09-21", "07:45");
  const review = {
    ...b.base(draftAt),
    periodStart: "2026-09-21",
    periodEnd: "2026-09-27",
    status: "draft" as const,
    approvedBy: null,
    approvedAt: null,
    exportedAt: null,
  };
  const current = {
    ...b.base(b.at(SEED_TODAY, "06:00")),
    periodStart: SEED_TODAY,
    periodEnd: "2026-10-04",
    status: "draft" as const,
    approvedBy: null,
    approvedAt: null,
    exportedAt: null,
  };
  t.payRuns.push(review, current);

  // E8.1: Jake's locked Thu 17 Sep 7.5 h line corrected to 8.0 h on 22 Sep → adjustment in last week's draft.
  const original = t.workLogs.find(
    (l) => l.crewMemberId === crew.jake && l.date === "2026-09-17" && l.basis === "hourly",
  )!;
  const editedHours = 800;
  const delta = adjustmentDelta(original, {
    quantity: editedHours,
    hours: editedHours,
    amountCents: hourlyAmount(editedHours, original.rateCents!, original.multiplier ?? 100),
  })!;
  const adjustment = b.adjustment(original, delta, {
    enteredBy: users.manager,
    createdAt: b.at(LATE_ENTERED_AT, "09:15"),
  });

  // Statement links for the last approved run (Dima and Lee).
  const statementTokens: SeedMeta["statementTokens"] = [];
  for (const key of ["dima", "lee"] as const) {
    const token = b.rng.hex(64); // 32 bytes (architecture §6)
    t.statementLinks.push({
      ...b.base(b.at("2026-09-21", "09:30")),
      payRunId: lastApproved.id,
      crewMemberId: crew[key],
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: b.at(addDays("2026-09-21", 90), "09:30"),
      revokedAt: null,
    });
    statementTokens.push({ payRunId: lastApproved.id, crewMemberId: crew[key], token });
  }

  // Files: a quote and a before photo on each active job; receipts on two Smith expenses.
  const addFile = (
    name: string,
    mime: string,
    bytes: number,
    entityType: "project" | "expense",
    entityId: Id,
    on: LocalDate,
  ) => {
    const f = {
      ...b.base(b.at(on, "11:00")),
      storageKey: `seed/${entityId}/${name.toLowerCase().replace(/[^a-z0-9.]+/g, "-")}`,
      name,
      mime,
      bytes,
      sha256: b.rng.hex(64),
      entityType,
      entityId,
    };
    t.files.push(f);
    return f;
  };
  for (const p of PROJECTS.filter((x) => x.status === "active")) {
    const row = projectRows.get(p.code)!;
    addFile("Quote.pdf", "application/pdf", 184_320, "project", row.id, p.createdOn);
    addFile(
      "Before — street side.jpg",
      "image/jpeg",
      1_245_184,
      "project",
      row.id,
      row.startDate ?? p.createdOn,
    );
  }
  const smithSheets = t.expenses.find(
    (e) => e.projectId === projects.smith && e.supplier === "Harbour Steel Supply" && e.date === "2026-09-22",
  )!;
  const dimaScrews = t.expenses.find((e) => e.paidBy === "crew" && e.date === "2026-09-23")!;
  smithSheets.receiptFileId = addFile(
    "Receipt — Harbour Steel.jpg",
    "image/jpeg",
    412_672,
    "expense",
    smithSheets.id,
    "2026-09-22",
  ).id;
  dimaScrews.receiptFileId = addFile(
    "Receipt — screws.jpg",
    "image/jpeg",
    286_720,
    "expense",
    dimaScrews.id,
    "2026-09-23",
  ).id;

  // Audit trail for recent money-relevant changes (Record history).
  const audit = (
    tableName: string,
    rowId: Id,
    action: "insert" | "update" | "delete",
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    actorUserId: Id,
    at: string,
  ) =>
    t.auditEvents.push({
      id: b.id(),
      workspaceId: t.workspace.id,
      tableName,
      rowId,
      action,
      before,
      after,
      actorUserId,
      at,
    });
  const samRate = t.rates.find((r) => r.crewMemberId === crew.sam && r.effectiveFrom === "2026-09-15")!;
  audit(
    "rate",
    samRate.id,
    "insert",
    null,
    { basis: "daily", amountCents: 32000, effectiveFrom: "2026-09-15" },
    users.manager,
    samRate.createdAt,
  );
  audit(
    "rate",
    override.id,
    "insert",
    null,
    { basis: "daily", amountCents: 36000, effectiveFrom: "2026-09-01", projectId: projects.rydeHeritage },
    users.manager,
    override.createdAt,
  );
  audit(
    "stage",
    stageOf("Y3").id,
    "update",
    { manualPctBp: null },
    { manualPctBp: 5000 },
    users.manager,
    b.at("2026-09-01", "17:40"),
  );
  audit(
    "stage",
    stageOf("Y5").id,
    "update",
    { status: "active" },
    { status: "paused", pauseReason: "materials" },
    users.manager,
    b.at("2026-09-14", "07:30"),
  );
  audit(
    "pay_run",
    lastApproved.id,
    "update",
    { status: "draft" },
    { status: "approved" },
    users.manager,
    lastApproved.approvedAt!,
  );
  const dimaAdvance = t.ledgerEntries.find(
    (e) => e.crewMemberId === crew.dima && e.kind === "advance" && e.date === "2026-09-21",
  )!;
  audit(
    "ledger_entry",
    dimaAdvance.id,
    "insert",
    null,
    { kind: "advance", amountCents: dimaAdvance.amountCents },
    users.manager,
    dimaAdvance.createdAt,
  );
  audit(
    "work_log",
    lateEntry!.id,
    "insert",
    null,
    { date: "2026-09-14", hours: lateEntry!.hours },
    users.manager,
    lateEntry!.createdAt,
  );
  audit(
    "work_log",
    adjustment.id,
    "insert",
    null,
    { adjustsLogId: original.id, hours: 50, amountCents: 1200 },
    users.manager,
    adjustment.createdAt,
  );
  audit(
    "expense",
    smithSheets.id,
    "update",
    { amountExGstCents: 850000, gstCents: 85000 },
    { amountExGstCents: smithSheets.amountExGstCents, gstCents: smithSheets.gstCents },
    users.manager,
    b.at("2026-09-23", "08:05"),
  );

  return {
    ...t,
    meta: {
      today: SEED_TODAY,
      now: SEED_NOW,
      historyStart: HISTORY_START,
      timezone: TIMEZONE,
      users,
      members,
      crew,
      projects,
      stages: {
        smithSheetInstall: stageOf("S5").id,
        patelSheetInstall: stageOf("P5").id,
        patelFlashings: stageOf("P6").id,
        rydeRepairs: stageOf("Y3").id,
        rydeRebed: stageOf("Y4").id,
        rydeCoat: stageOf("Y5").id,
        harrisTile: stageOf("H5").id,
        harrisRidge: stageOf("H6").id,
        wongCleanUp: stageOf("W3").id,
        brownRidge: stageOf("B6").id,
        kellyRepairs: stageOf("K3").id,
      },
      payRuns: { review: review.id, current: current.id, lastApproved: lastApproved.id },
      logs: { lateEntry: lateEntry!.id, adjustment: adjustment.id, adjustedOriginal: original.id },
      expenses: { dimaScrews: dimaScrews.id, smithSheets: smithSheets.id },
      statementTokens,
      scenarios: SCENARIOS,
    },
  };
}

const SCENARIOS = [
  "E12.1 Smith job — Ryde re-roof · Sheet install trending over by $775.00 (watch)",
  "E12.2 Ryde heritage · Repairs & replacements trending over by $300.00 (watch)",
  "E12.3 Wong job · Clean-up over budget by $100.00 (over)",
  "Ryde heritage · Coat / paint paused waiting on materials since 14 Sep (> 5 working days)",
  "Last week's gaps: Jake Fri, Ravi Fri, Nick Thu–Fri",
  "Kev unpaid too long (oldest unpaid credit 7 Sep)",
  "Tom below the award floor last week (E10.1)",
  "Pay run 21–27 Sep (draft): missing rate Jake lm (blocking), double pay Lee 23 Sep, late entry Ben 14 Sep, adjustment Jake 17 Sep, Dima reimbursement $110.00",
  "E5.1 Harris ridge bedding ready for Done (Sam/Tom/Dima)",
  "E13.1 Patel sheet install: 6 real working days, 3 lost to weather",
];

function fail(message: string): never {
  throw new Error(message);
}
