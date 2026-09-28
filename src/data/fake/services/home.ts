import { dayKey } from "@/domain/attendance";
import { addDays, eachDay } from "@/domain/dates";
import { sum } from "@/domain/money";
import type { PayPeriod } from "@/domain/periods";
import { ratioBp } from "@/domain/ratios";
import type { Unit } from "@/domain/types";
import type {
  ActiveJobRow,
  Actor,
  AttentionItem,
  AttentionKind,
  HomeService,
  HomeView,
  LastWeekFigures,
  PayPeriodFigures,
  Severity,
} from "../../contracts";
import { demoOutbox } from "../demo";
import { FIELD_ACCESS, type FakeContext } from "./context";

/** Max rows in Home's "Needs attention" (product spec §5.9). */
export const ATTENTION_LIMIT = 7;

/** Red before amber. */
export const SEVERITY_ORDER: readonly Severity[] = ["over", "watch"];

/**
 * Within a severity, product spec §5.9's list order: jobs over labour budget → trending over →
 * stages paused > 5 working days → last week's logging gaps → outbox entries needing attention →
 * balances unpaid too long → pay lines below the award floor.
 */
export const ATTENTION_ORDER: readonly AttentionKind[] = [
  "over_budget",
  "trending_over",
  "paused_too_long",
  "logging_gaps",
  "outbox_attention",
  "unpaid_too_long",
  "below_floor",
];

const desc = (a: number, b: number) => (a > b ? -1 : a < b ? 1 : 0);

/** Within a kind: the bigger amount, longer pause or older debt first. */
function compareWithin(a: AttentionItem, b: AttentionItem): number {
  if ((a.kind === "over_budget" || a.kind === "trending_over") && (b.kind === "over_budget" || b.kind === "trending_over"))
    return desc(a.byCents, b.byCents);
  if (a.kind === "paused_too_long" && b.kind === "paused_too_long") return desc(a.workingDays, b.workingDays);
  if (a.kind === "unpaid_too_long" && b.kind === "unpaid_too_long") return a.since.localeCompare(b.since);
  if (a.kind === "below_floor" && b.kind === "below_floor") return desc(a.shortfallCents, b.shortfallCents);
  return 0;
}

export function sortAttention(items: AttentionItem[]): AttentionItem[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort(
      (a, b) =>
        SEVERITY_ORDER.indexOf(a.item.severity) - SEVERITY_ORDER.indexOf(b.item.severity) ||
        ATTENTION_ORDER.indexOf(a.item.kind) - ATTENTION_ORDER.indexOf(b.item.kind) ||
        compareWithin(a.item, b.item) ||
        a.i - b.i,
    )
    .map(({ item }) => item);
}

const UNIT_ORDER: readonly Unit[] = ["m2", "lm", "each"];

export function createHomeService(c: FakeContext): HomeService {
  const activeProjects = () => c.t.projects.filter((p) => p.status === "active");

  function needsAttention(lastWeek: PayPeriod): AttentionItem[] {
    const fig = c.fig;
    const items: AttentionItem[] = [];
    for (const project of activeProjects()) {
      for (const sf of fig.project(project.id).stages) {
        const base = {
          projectId: project.id,
          projectName: project.nickname,
          stageId: sf.stage.id,
          stageName: sf.stage.name,
          href: `/jobs/${project.id}/stages/${sf.stage.id}`,
        };
        if (sf.alert) {
          const kind = sf.alert.level === "over" ? "over_budget" : "trending_over";
          items.push({
            ...base,
            id: `${kind}:${sf.stage.id}`,
            kind,
            severity: sf.alert.severity,
            byCents: sf.alert.byCents,
          });
        }
        const pause = fig.pauseOf(sf.stage.id);
        if (pause && fig.pausedTooLong(sf.stage.id)) {
          items.push({
            ...base,
            id: `paused_too_long:${sf.stage.id}`,
            kind: "paused_too_long",
            severity: "watch",
            reason: pause.reason,
            since: pause.since,
            workingDays: pause.workingDays,
          });
        }
      }
    }
    const gaps = new Map<string, string[]>();
    for (const g of fig.gaps(lastWeek))
      gaps.set(g.crewMemberId, [...(gaps.get(g.crewMemberId) ?? []), g.date]);
    if (gaps.size > 0) {
      items.push({
        id: `logging_gaps:${lastWeek.start}`,
        kind: "logging_gaps",
        severity: "watch",
        href: `/log?date=${[...gaps.values()][0]![0]}`,
        period: lastWeek,
        gaps: [...gaps].map(([crewMemberId, dates]) => ({
          crewMemberId,
          name: fig.crewOf(crewMemberId).name,
          dates,
        })),
      });
    }
    const outbox = demoOutbox(c.options.demo, c.t, c.now()).filter((i) => i.state === "needs_attention");
    if (outbox.length > 0) {
      items.push({
        id: "outbox_attention",
        kind: "outbox_attention",
        severity: "over",
        href: "/outbox",
        count: outbox.length,
      });
    }
    for (const crew of c.t.crewMembers) {
      const ledger = fig.ledger(crew.id);
      if (ledger.unpaidTooLong) {
        items.push({
          id: `unpaid_too_long:${crew.id}`,
          kind: "unpaid_too_long",
          severity: "watch",
          href: `/crew/${crew.id}`,
          crewMemberId: crew.id,
          name: crew.name,
          balanceCents: ledger.balanceCents,
          since: ledger.oldestUnpaidDate!,
        });
      }
    }
    const review = fig.reviewRun();
    if (review) {
      for (const p of fig.run(review.id).people) {
        if (!p.floor?.below) continue;
        items.push({
          id: `below_floor:${review.id}:${p.crew.id}`,
          kind: "below_floor",
          severity: "watch",
          href: `/pay/${review.id}#crew-${p.crew.id}`,
          crewMemberId: p.crew.id,
          name: p.crew.name,
          payRunId: review.id,
          shortfallCents: p.floor.shortfallCents,
        });
      }
    }
    return sortAttention(items).slice(0, ATTENTION_LIMIT);
  }

  function activeJobs(): ActiveJobRow[] {
    const rank = (r: ActiveJobRow) => (r.alert === null ? 2 : r.alert.level === "over" ? 0 : 1);
    return activeProjects()
      .map((p) => {
        const f = c.fig.project(p.id);
        return {
          projectId: p.id,
          name: p.nickname,
          currentStages: c.fig.currentStages(p.id),
          pctBp: f.pctBp,
          labourActualCents: f.labourActualCents,
          labourBudgetCents: f.labourBudgetCents,
          forecastMarginCents: f.margins.forecastMarginCents,
          daysSinceLastLog: f.daysSinceLastLog,
          alert: f.alert,
          href: `/jobs/${p.id}`,
        };
      })
      .sort(
        (a, b) =>
          rank(a) - rank(b) ||
          desc(a.alert?.byCents ?? 0, b.alert?.byCents ?? 0) ||
          a.name.localeCompare(b.name),
      );
  }

  function lastWeekFigures(period: PayPeriod): LastWeekFigures {
    const fig = c.fig;
    const endExclusive = addDays(period.end, 1) < c.today ? addDays(period.end, 1) : c.today;
    const logs = eachDay(period.start, addDays(period.end, 1)).flatMap((d) => [...c.ix.logsOn(d)]);
    const inPeriod = (date: string) => date >= period.start && date <= period.end;
    const progress = c.t.progressEntries.filter((p) => inPeriod(p.date));
    const installed = UNIT_ORDER.map((unit) => ({
      unit,
      quantity: sum(progress.filter((p) => c.ix.stages.get(p.stageId)!.unit === unit).map((p) => p.quantity)),
    })).filter((x) => x.quantity !== 0);
    const crew = c.t.crewMembers.filter(
      (m) => m.activeFrom <= period.end && (m.activeTo === null || m.activeTo >= period.start),
    );
    const util = crew.map((m) => fig.utilisationOf(m.id, period.start, endExclusive));
    return {
      period,
      labourCostCents: fig.labourOf(logs),
      hours: sum(logs.map((l) => l.hours)),
      crewDays: new Set(logs.map((l) => dayKey(l.crewMemberId, l.date))).size,
      installed,
      expensesCents: sum(c.t.expenses.filter((e) => inPeriod(e.date)).map((e) => fig.expenseCostOf(e))),
      utilisationBp: ratioBp(sum(util.map((u) => u.workedDays)), sum(util.map((u) => u.availableDays))),
      gaps: fig.gaps(period).length,
    };
  }

  function payPeriod(): PayPeriodFigures | null {
    const review = c.fig.reviewRun();
    if (!review) return null;
    const run = c.fig.run(review.id);
    return {
      payRunId: review.id,
      period: run.period,
      status: review.status,
      draftTotalCents: run.totals.totalCents,
      employeesCents: run.totals.employeesCents,
      contractorsCents: run.totals.contractorsCents,
      outstandingBalancesCents: sum(c.t.crewMembers.map((m) => Math.max(c.fig.ledger(m.id).balanceCents, 0))),
      flagCount: run.flags.length,
      blocking: run.blockedBy.length > 0,
      href: `/pay/${review.id}`,
    };
  }

  return {
    async get(actor: Actor): Promise<HomeView> {
      const today = c.today;
      if (c.isForeman(actor)) {
        const visible = c.visibleProjects(actor)!;
        const jobs = activeProjects()
          .filter((p) => visible.has(p.id))
          .map((p) => ({
            projectId: p.id,
            name: p.nickname,
            siteAddress: p.siteAddress,
            currentStages: c.fig.currentStages(p.id),
            pctBp: c.fig.project(p.id).pctBp,
            loggedToday: c.ix.logsOfProject(p.id).some((l) => l.date === today),
            daysSinceLastLog: c.fig.project(p.id).daysSinceLastLog,
            href: `/jobs/${p.id}`,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        return {
          view: "foreman",
          access: FIELD_ACCESS,
          today,
          jobs,
          logToday: { href: "/log", projectId: jobs.length === 1 ? jobs[0]!.projectId : null },
        };
      }
      const access = c.access(actor);
      const current = c.fig.periodContaining(today);
      const lastWeek = c.fig.periodContaining(addDays(current.start, -1));
      return {
        view: "manager",
        access,
        today,
        needsAttention: needsAttention(lastWeek),
        activeJobs: activeJobs(),
        lastWeek: lastWeekFigures(lastWeek),
        payPeriod: payPeriod(),
      };
    },
  };
}
