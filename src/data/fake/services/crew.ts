import { addDays } from "@/domain/dates";
import { ledgerBalance } from "@/domain/ledger";
import { resolveRate } from "@/domain/rates";
import type {
  Actor,
  CrewDetail,
  CrewList,
  CrewRowForeman,
  CrewService,
  Id,
  LedgerRow,
  RateDto,
  StatementRef,
} from "../../contracts";
import type { CrewMemberRow } from "../rows";
import { FIELD_ACCESS, notFound, notYet, type FakeContext } from "./context";

/** How many recent logs a crew member's page shows. */
const RECENT_LOGS = 20;

export function crewRowForeman(m: CrewMemberRow, today: string): CrewRowForeman {
  return {
    id: m.id,
    name: m.name,
    type: m.type,
    active: m.activeFrom <= today && (m.activeTo === null || m.activeTo >= today),
    defaultBasis: m.defaultBasis,
    defaultUnit: m.defaultUnit,
  };
}

/** Ledger rows newest first, each with the balance after it (running, in date order). */
export function ledgerRows(c: FakeContext, crewId: Id): LedgerRow[] {
  const rows = c.ix.ledgerOf(crewId);
  const entries = c.fig.ledger(crewId).entries;
  return rows
    .map((e, i) => ({
      id: e.id,
      date: e.date,
      kind: e.kind,
      amountCents: e.amountCents,
      method: e.method,
      note: e.note,
      payRunId: e.payRunId,
      balanceAfterCents: ledgerBalance(entries.slice(0, i + 1)),
    }))
    .reverse();
}

export function createCrewService(c: FakeContext): CrewService {
  const isActive = (m: CrewMemberRow) => m.activeTo === null || m.activeTo >= c.today;

  function requireCrew(crewId: Id): CrewMemberRow {
    const crew = c.ix.crew.get(crewId);
    if (!crew) throw notFound("crew member");
    return crew;
  }

  function rates(crew: CrewMemberRow): RateDto[] {
    const all = c.ix.ratesOf(crew.id);
    return [...all]
      .sort(
        (a, b) =>
          a.basis.localeCompare(b.basis) ||
          (a.unit ?? "").localeCompare(b.unit ?? "") ||
          (a.projectId ?? "").localeCompare(b.projectId ?? "") ||
          b.effectiveFrom.localeCompare(a.effectiveFrom),
      )
      .map((r) => {
        const project = r.projectId === null ? null : c.ix.projects.get(r.projectId)!;
        const current = resolveRate(all, {
          crewMemberId: crew.id,
          basis: r.basis,
          unit: r.unit,
          projectId: r.projectId ?? "",
          date: c.today,
        });
        return {
          id: r.id,
          basis: r.basis,
          unit: r.unit,
          amountCents: r.amountCents,
          effectiveFrom: r.effectiveFrom,
          project: project && { id: project.id, name: project.nickname },
          current: current?.id === r.id,
        };
      });
  }

  function statements(crew: CrewMemberRow): StatementRef[] {
    const approved = c.ix
      .ledgerOf(crew.id)
      .filter((e) => e.kind === "payrun_credit" && e.payRunId !== null)
      .map((e) => {
        const run = c.ix.payRuns.get(e.payRunId!)!;
        return {
          payRunId: run.id,
          period: { start: run.periodStart, end: run.periodEnd },
          status: run.status,
          totalCents: e.amountCents,
          shareable: true,
        };
      });
    const drafts = c.t.payRuns
      .filter((r) => r.status === "draft")
      .flatMap((r) => {
        const person = c.fig.run(r.id).people.find((p) => p.crew.id === crew.id);
        return person
          ? [
              {
                payRunId: r.id,
                period: { start: r.periodStart, end: r.periodEnd },
                status: r.status,
                totalCents: person.totals.totalCents,
                shareable: false,
              },
            ]
          : [];
      });
    return [...drafts, ...approved].sort((a, b) => b.period.start.localeCompare(a.period.start));
  }

  return {
    async list(actor: Actor, filter?: { includeInactive?: boolean }): Promise<CrewList> {
      const crew = c.t.crewMembers
        .filter((m) => filter?.includeInactive || isActive(m))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (c.isForeman(actor))
        return { view: "foreman", access: FIELD_ACCESS, rows: crew.map((m) => crewRowForeman(m, c.today)) };
      return {
        view: "manager",
        access: c.access(actor),
        rows: crew.map((m) => {
          const level = m.levelId === null ? null : c.ix.levels.get(m.levelId)!;
          const ledger = c.fig.ledger(m.id);
          const logs = c.ix.logsOfCrew(m.id);
          return {
            ...crewRowForeman(m, c.today),
            level: level && { id: level.id, name: level.name },
            gstRegistered: m.gstRegistered,
            balanceCents: ledger.balanceCents,
            unpaidTooLong: ledger.unpaidTooLong,
            lastLogDate: logs.reduce<string | null>((d, l) => (d === null || l.date > d ? l.date : d), null),
          };
        }),
      };
    },

    async get(actor: Actor, crewMemberId: Id): Promise<CrewDetail> {
      const access = c.access(actor);
      const m = requireCrew(crewMemberId);
      const level = m.levelId === null ? null : c.ix.levels.get(m.levelId)!;
      const ledger = c.fig.ledger(m.id);
      const recent = [...c.ix.logsOfCrew(m.id)]
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
        .slice(0, RECENT_LOGS);
      return {
        view: "manager",
        access,
        id: m.id,
        name: m.name,
        phone: m.phone,
        type: m.type,
        level: level && { id: level.id, name: level.name, floorRateCents: level.floorRateCents },
        abn: m.abn,
        gstRegistered: m.gstRegistered,
        activeFrom: m.activeFrom,
        activeTo: m.activeTo,
        defaultBasis: m.defaultBasis,
        defaultUnit: m.defaultUnit,
        rates: rates(m),
        recentLogs: recent.map((l) => c.logManager(l)),
        balanceCents: ledger.balanceCents,
        oldestUnpaidDate: ledger.oldestUnpaidDate,
        unpaidTooLong: ledger.unpaidTooLong,
        ledger: ledgerRows(c, m.id),
        statements: statements(m),
        utilisation: c.fig.utilisationOf(m.id, addDays(c.today, -28), c.today),
      };
    },

    async rates(actor: Actor, crewMemberId: Id): Promise<RateDto[]> {
      c.access(actor);
      return rates(requireCrew(crewMemberId));
    },

    create: () => notYet("crew.create"),
    update: () => notYet("crew.update"),
    setRate: () => notYet("crew.setRate"),
  };
}
