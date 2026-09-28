/**
 * Two years of completed jobs for the seed: three teams working jobs back to back, with a shared
 * Sydney rain calendar (weather pauses + rain markers), leave and sick days, occasional
 * "waiting on materials" pauses (the team moves on to the next stage meanwhile), progress entries for
 * per-unit workers, lump-sum stages paid at Done, and expenses (some paid by crew → reimbursements).
 */
import { addDays, dayOfWeek } from "@/domain/dates";
import type { Hundredths, LocalDate } from "@/domain/types";
import type { Id, JobType } from "../contracts";
import type { CrewMemberRow, ProjectRow, StageRow } from "./rows";
import {
  STANDARD_DAY,
  WORKING_DAYS,
  type GridSpec,
  type SeedBuilder,
  type TemplateItemDef,
} from "./seed-builder";

export interface HistoryTeam {
  members: Id[];
  jobTypes: JobType[];
}

export interface HistoryOptions {
  start: LocalDate;
  /** Last day any history job may work (inclusive). */
  cutoff: LocalDate;
  teams: HistoryTeam[];
  templates: Record<JobType, TemplateItemDef[]>;
  enteredBy: Id;
}

const DURATION: Record<string, [number, number]> = {
  "Site setup & safety": [1, 1],
  "Site setup": [1, 1],
  "Strip & remove": [2, 3],
  "Battens / structural repairs": [1, 3],
  Battens: [2, 3],
  "Sarking & insulation": [1, 2],
  Sarking: [1, 2],
  "Sheet install": [3, 5],
  "Tile install": [3, 6],
  "Roof sheeting/tiles": [3, 5],
  "Flashings, gutters & downpipes": [2, 3],
  Flashings: [1, 2],
  "Gutters & downpipes": [1, 2],
  "Ridge bedding & pointing": [2, 3],
  "Clean-up & handover": [1, 1],
  "Clean-up": [1, 1],
  "Pressure clean": [1, 2],
  "Repairs & replacements": [1, 3],
  "Re-bed & re-point": [2, 4],
  "Coat / paint": [2, 3],
  Inspect: [1, 1],
  Repair: [1, 2],
};

const SURNAMES = [
  "Nguyen",
  "Taylor",
  "Anderson",
  "Thomas",
  "Walker",
  "White",
  "Martin",
  "Thompson",
  "Robinson",
  "Clarke",
  "Ryan",
  "Murphy",
  "O'Brien",
  "Kennedy",
  "Campbell",
  "Stewart",
  "Morris",
  "Cooper",
  "Bell",
  "Mitchell",
  "Russo",
  "Costa",
  "Papadopoulos",
  "Singh",
  "Chen",
  "Li",
  "Kaur",
  "Ali",
  "Hughes",
  "Edwards",
  "Fraser",
  "Grant",
  "Hunter",
  "Lawson",
  "McDonald",
  "Parker",
  "Reid",
  "Shaw",
  "Watson",
  "Young",
  "Baker",
  "Carter",
  "Dixon",
  "Ellis",
  "Foster",
  "Gibson",
  "Hayes",
  "Jackson",
  "Knight",
  "Lloyd",
];
const FIRST = [
  "Anne",
  "Bruce",
  "Carol",
  "David",
  "Emma",
  "Frank",
  "Grace",
  "Helen",
  "Ian",
  "Julie",
  "Kate",
  "Liam",
  "Maria",
  "Neil",
  "Olivia",
  "Paul",
  "Rosa",
  "Steve",
  "Tina",
  "Vince",
];
const SUBURBS = [
  "Hornsby",
  "Epping",
  "Chatswood",
  "Lane Cove",
  "Gladesville",
  "Hunters Hill",
  "Putney",
  "Eastwood",
  "Carlingford",
  "Beecroft",
  "Pennant Hills",
  "Turramurra",
  "Pymble",
  "Lindfield",
  "Roseville",
  "Artarmon",
  "Willoughby",
  "Northbridge",
  "Cremorne",
  "Neutral Bay",
  "Drummoyne",
  "Five Dock",
  "Concord",
  "Strathfield",
  "Burwood",
  "Ashfield",
  "Leichhardt",
  "Annandale",
  "Marrickville",
  "Dulwich Hill",
  "Parramatta",
  "Baulkham Hills",
  "Castle Hill",
  "Dee Why",
  "Collaroy",
  "Narrabeen",
  "Mona Vale",
  "Avalon",
  "Cronulla",
  "Miranda",
];
const STREETS = [
  "Pacific Hwy",
  "Victoria Rd",
  "High St",
  "Church St",
  "Park Rd",
  "King St",
  "George St",
  "Station St",
  "Bay Rd",
  "Forest Rd",
];
const LABEL: Record<JobType, string[]> = {
  metal_reroof: ["re-roof", "metal re-roof"],
  tile_reroof: ["tile re-roof", "re-tile"],
  restoration: ["restoration", "roof restoration"],
  repair: ["leak repair", "storm repair", "repair"],
  new_build: ["new build", "extension roof"],
};
const MAIN_MATERIALS: Record<string, { supplier: string; range: [number, number] }> = {
  "Sheet install": { supplier: "Harbour Steel Supply", range: [400, 1300] },
  "Roof sheeting/tiles": { supplier: "Harbour Steel Supply", range: [400, 1200] },
  "Tile install": { supplier: "Coastal Tile Co", range: [500, 1400] },
  "Coat / paint": { supplier: "Paint Depot", range: [120, 350] },
  Repair: { supplier: "RoofMart", range: [15, 90] },
  "Repairs & replacements": { supplier: "RoofMart", range: [40, 180] },
  Battens: { supplier: "Northside Timber", range: [80, 250] },
  "Battens / structural repairs": { supplier: "Northside Timber", range: [80, 250] },
  "Flashings, gutters & downpipes": { supplier: "Gutter Supplies Co", range: [60, 200] },
  "Gutters & downpipes": { supplier: "Gutter Supplies Co", range: [60, 180] },
  Flashings: { supplier: "Gutter Supplies Co", range: [30, 90] },
};

type DayPlan =
  | { date: LocalDate; kind: "rain" }
  | { date: LocalDate; kind: "idle" }
  | { date: LocalDate; kind: "work"; slot: number; present: Id[] };

// Day stepping is the hot loop of the seed; memoise it (pure, so sharing across builds is safe).
const nextDayMemo = new Map<LocalDate, LocalDate>();
const workingMemo = new Map<LocalDate, boolean>();
function nextDay(d: LocalDate): LocalDate {
  let n = nextDayMemo.get(d);
  if (n === undefined) nextDayMemo.set(d, (n = addDays(d, 1)));
  return n;
}
function isWorkingDay(d: LocalDate): boolean {
  let w = workingMemo.get(d);
  if (w === undefined) workingMemo.set(d, (w = WORKING_DAYS.includes(dayOfWeek(d))));
  return w;
}
const activeOn = (c: CrewMemberRow, d: LocalDate) =>
  c.activeFrom <= d && (c.activeTo === null || d <= c.activeTo);

export function generateHistory(b: SeedBuilder, o: HistoryOptions): void {
  const rng = b.rng;
  const days: LocalDate[] = [];
  for (let d = o.start; d <= o.cutoff; d = nextDay(d)) if (isWorkingDay(d)) days.push(d);

  // Shared weather: rain comes in runs.
  const rain = new Set<LocalDate>();
  let raining = false;
  for (const d of days) {
    raining = raining ? rng.chance(0.45) : rng.chance(0.05);
    if (raining) rain.add(d);
  }

  // Leave (two 5-day blocks a year) and sick days.
  const away = new Map<string, "leave" | "sick">();
  const everyone = o.teams.flatMap((t) => t.members.map((id) => b.crewRow(id)));
  for (const c of everyone) {
    const mine = days.filter((d) => activeOn(c, d));
    for (let i = 0; i + 250 <= mine.length + 125; i += 250) {
      for (let k = 0; k < 2; k++) {
        const from = rng.int(i, Math.min(i + 249, mine.length - 5));
        for (const d of mine.slice(from, from + 5)) away.set(`${c.id}|${d}`, "leave");
      }
    }
    for (const d of mine)
      if (!away.has(`${c.id}|${d}`) && rng.chance(0.012)) away.set(`${c.id}|${d}`, "sick");
  }

  const usedNames = new Set<string>();
  for (const team of o.teams) {
    let cursor = o.start;
    for (;;) {
      const jobType = rng.pick(team.jobTypes);
      let plan = planJob(b, team, o.templates[jobType], cursor, rain, away);
      let type = jobType;
      if (plan.end > o.cutoff) {
        plan = planJob(b, team, o.templates.repair, cursor, rain, away);
        type = "repair";
      }
      if (plan.end > o.cutoff) break;
      commitJob(b, o, type, plan, usedNames, away);
      cursor = nextDay(plan.end);
    }
    // Nothing more fits before the cutoff: the team takes leave (or is rained off).
    for (let d = cursor; d <= o.cutoff; d = nextDay(d)) {
      if (!isWorkingDay(d)) continue;
      for (const id of team.members) {
        if (!activeOn(b.crewRow(id), d)) continue;
        b.noWork(id, d, rain.has(d) ? "rain" : "leave", { enteredBy: o.enteredBy });
      }
    }
  }
}

interface JobPlan {
  items: TemplateItemDef[];
  durations: number[];
  slots: number[];
  materialsStage: number | null;
  days: DayPlan[];
  end: LocalDate;
  team: HistoryTeam;
}

function planJob(
  b: SeedBuilder,
  team: HistoryTeam,
  items: TemplateItemDef[],
  cursor: LocalDate,
  rain: ReadonlySet<LocalDate>,
  away: ReadonlyMap<string, "leave" | "sick">,
): JobPlan {
  const rng = b.rng;
  const durations = items.map((it) => rng.int(...(DURATION[it.name] ?? [1, 2])));
  let slots = durations.flatMap((n, i) => Array.from({ length: n }, () => i));
  let materialsStage: number | null = null;
  const candidates = durations
    .map((n, i) => i)
    .filter((i) => i > 0 && i < items.length - 1 && durations[i]! >= 2);
  if (candidates.length > 0 && rng.chance(0.15)) {
    const i = rng.pick(candidates);
    const k = rng.int(1, durations[i]! - 1);
    const m = Math.min(rng.int(2, 4), durations[i + 1]!);
    const first = slots.indexOf(i);
    const iSlots = slots.filter((s) => s === i);
    const nextSlots = slots.filter((s) => s === i + 1);
    const rest = slots.filter((s) => s !== i && s !== i + 1);
    const before = rest.filter((s) => s < i);
    const after = rest.filter((s) => s > i + 1);
    slots = [
      ...before,
      ...iSlots.slice(0, k),
      ...nextSlots.slice(0, m),
      ...iSlots.slice(k),
      ...nextSlots.slice(m),
      ...after,
    ];
    if (slots.indexOf(i) !== first) throw new Error("materials interleave broke stage order");
    materialsStage = i;
  }
  const crew = team.members.map((id) => b.crewRow(id));
  const days: DayPlan[] = [];
  let d = cursor;
  let s = 0;
  let end = cursor;
  while (s < slots.length) {
    if (isWorkingDay(d)) {
      if (rain.has(d)) days.push({ date: d, kind: "rain" });
      else {
        const present = crew.filter((c) => activeOn(c, d) && !away.has(`${c.id}|${d}`)).map((c) => c.id);
        if (present.length === 0) days.push({ date: d, kind: "idle" });
        else {
          days.push({ date: d, kind: "work", slot: s, present });
          end = d;
          s++;
        }
      }
    }
    d = nextDay(d);
  }
  return { items, durations, slots, materialsStage, days, end, team };
}

function commitJob(
  b: SeedBuilder,
  o: HistoryOptions,
  jobType: JobType,
  plan: JobPlan,
  usedNames: Set<string>,
  away: ReadonlyMap<string, "leave" | "sick">,
): void {
  const rng = b.rng;
  const actualType = jobType;
  let surname = rng.pick(SURNAMES);
  const suburb = rng.pick(SUBURBS);
  let nickname = `${surname} job — ${suburb} ${rng.pick(LABEL[actualType])}`;
  while (usedNames.has(nickname)) {
    surname = rng.pick(SURNAMES);
    nickname = `${surname} job — ${suburb} ${rng.pick(LABEL[actualType])}`;
  }
  usedNames.add(nickname);
  const firstDay = plan.days[0]!.date;
  const createdOn = addDays(firstDay, -rng.int(7, 30));
  const client = {
    ...b.base(b.at(createdOn, "09:30")),
    name: `${rng.pick(FIRST)} ${surname}`,
    phone: `04${rng.int(10, 99)} ${rng.int(100, 999)} ${rng.int(100, 999)}`,
    email: null,
    address: `${rng.int(1, 180)} ${rng.pick(STREETS)}, ${suburb} NSW`,
  };
  b.t.clients.push(client);
  const project = b.addProject({
    clientId: client.id,
    nickname,
    siteAddress: client.address,
    jobType: actualType,
    status: "complete",
    createdOn,
  });
  const stages: StageRow[] = plan.items.map((item, i) => {
    const lump =
      (item.name === "Ridge bedding & pointing" && rng.chance(0.5)) ||
      (item.name === "Re-bed & re-point" && rng.chance(0.3))
        ? rng.int(12, 25) * 10_000
        : null;
    return b.addStage(project, item, i + 1, { lumpSumCents: lump });
  });
  const lastSlotOf = new Map<number, number>();
  plan.slots.forEach((stageIndex, slot) => lastSlotOf.set(stageIndex, slot));
  const enteredBy = o.enteredBy;
  const expensed = new Set<number>();
  let prevStage: number | null = null;

  for (const day of plan.days) {
    const date = day.date;
    const teamActive = plan.team.members.filter((id) => activeOn(b.crewRow(id), date));
    for (const id of teamActive) {
      const why = away.get(`${id}|${date}`);
      if (why) b.noWork(id, date, why, { enteredBy });
    }
    if (day.kind === "rain") {
      for (const st of stages) if (st.status === "active") b.pauseStage(st.id, date, "weather", "Rain");
      for (const id of teamActive) b.noWork(id, date, "rain", { enteredBy });
      continue;
    }
    if (day.kind === "idle") continue;
    const index = plan.slots[day.slot]!;
    const stage = stages[index]!;
    // Leaving the stage that waits on materials: it pauses today (or stays paused if rain already
    // paused it), and is not resumed with the other rain-paused stages.
    const waiting =
      plan.materialsStage !== null && prevStage === plan.materialsStage && index !== prevStage
        ? stages[plan.materialsStage]!
        : null;
    for (const st of stages) {
      if (st !== waiting && st.status === "paused" && b.pausedBy(st.id) === "weather") b.resumeStage(st.id, date);
    }
    if (waiting?.status === "active") b.pauseStage(waiting.id, date, "materials", "Waiting on materials");
    if (stage.status === "paused") b.resumeStage(stage.id, date);
    const specs: GridSpec[] = day.present.map((crewId) => {
      const crew = b.crewRow(crewId);
      const basis = b.gridBasis(crew, stage);
      if (basis === "daily") return { crewId, days: rng.chance(0.03) ? 50 : 100 };
      if (basis === "hourly") {
        const hours: Hundredths = rng.pick([800, 800, 800, 800, 750, 850, 900]);
        return rng.chance(0.04) ? { crewId, hours, overtimeHours: 200 } : { crewId, hours };
      }
      return { crewId, hours: STANDARD_DAY };
    });
    b.grid(date, stage.id, specs, { enteredBy });
    if (!expensed.has(index)) {
      expensed.add(index);
      jobExpenses(b, project, stage, index, date, day.present, enteredBy);
    }
    if (stage.unit !== null) {
      const pieceWorkers = day.present.filter((id) => {
        const c = b.crewRow(id);
        return c.defaultBasis === "per_unit" && c.defaultUnit === stage.unit;
      });
      if (pieceWorkers.length > 0) {
        const perHead = stage.unit === "lm" ? [20, 35] : [30, 45];
        const qty = pieceWorkers.reduce((acc) => acc + rng.int(perHead[0]!, perHead[1]!) * 100, 0);
        b.progress(date, stage.id, pieceWorkers, qty, { mode: "equal" }, { enteredBy });
      }
    }
    if (lastSlotOf.get(index) === day.slot) b.doneStage(stage.id, date);
    prevStage = index;
  }
  project.targetFinish = addDays(plan.end, rng.int(-3, 7));
  b.finaliseBudgets(project, {
    labourFactor: [8_800, 12_500],
    materialsFactor: [9_500, 12_000],
    markupBp: [11_800, 14_500],
  });
  if (plan.end < addDays(o.cutoff, -120)) project.status = "closed";
}

function jobExpenses(
  b: SeedBuilder,
  project: ProjectRow,
  stage: StageRow,
  index: number,
  date: LocalDate,
  present: readonly Id[],
  enteredBy: Id,
): void {
  const rng = b.rng;
  if (index === 0 && project.jobType !== "repair") {
    b.expense({
      date,
      projectId: project.id,
      stageId: null,
      category: "Scaffolding",
      supplier: "Ace Scaffold Hire",
      totalCents: rng.int(90, 260) * 1_000,
      paidBy: "company_card",
      enteredBy,
    });
  }
  if (stage.name === "Strip & remove") {
    b.expense({
      date,
      projectId: project.id,
      stageId: stage.id,
      category: "Skip/tip fees",
      supplier: "Bin It Skips",
      totalCents: rng.int(45, 95) * 1_000,
      paidBy: "company_card",
      enteredBy,
    });
  }
  const main = MAIN_MATERIALS[stage.name];
  if (main) {
    b.expense({
      date,
      projectId: project.id,
      stageId: stage.id,
      category: "Materials",
      supplier: main.supplier,
      totalCents: rng.int(...main.range) * 1_000,
      paidBy: "company_card",
      enteredBy,
    });
  }
  if (index === 0 && rng.chance(0.4)) {
    const byCrew = rng.chance(0.3);
    b.expense({
      date,
      projectId: project.id,
      stageId: null,
      category: "Fuel & travel",
      supplier: "Metro Fuel",
      totalCents: rng.int(40, 180) * 100,
      paidBy: byCrew ? "crew" : "cash",
      crewMemberId: byCrew ? rng.pick(present) : null,
      enteredBy,
    });
  }
}
