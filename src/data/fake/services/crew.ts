import { addDays } from "@/domain/dates";
import { ledgerBalance } from "@/domain/ledger";
import { resolveRate } from "@/domain/rates";
import type {
  Actor,
  CrewDetail,
  CrewInput,
  CrewList,
  CrewRowForeman,
  CrewService,
  Id,
  LedgerRow,
  RateDto,
  RateInput,
  StatementRef,
} from "../../contracts";
import type { CrewMemberRow, RateRow } from "../rows";
import { FIELD_ACCESS, notFound, type FakeContext } from "./context";
import { amountOf, invalid, rateFor, requireEditor, snapshot, write } from "./writes";

/** Level, pay basis and dates that a crew record must agree on, else `invalid`. */
function checkCrew(c: FakeContext, input: CrewInput): void {
  if (input.levelId !== null && !c.ix.levels.has(input.levelId)) throw invalid("Pick a level from the list.");
  if (input.defaultBasis === "per_unit" && input.defaultUnit === null)
    throw invalid("Pick the unit this person is paid by: m², lm or each.");
  if (input.activeTo !== null && input.activeTo < input.activeFrom)
    throw invalid("The last day can't be before the first day.");
  if (input.type === "employee" && input.gstRegistered)
    throw invalid("Only an ABN contractor can be registered for GST.");
}

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

    async create(actor: Actor, input: CrewInput): Promise<{ id: Id }> {
      requireEditor(c, actor);
      checkCrew(c, input);
      const id = write(c, actor, "crew_create", (w) => {
        const row: CrewMemberRow = {
          ...w.base(),
          ...input,
          defaultUnit: input.defaultBasis === "per_unit" ? input.defaultUnit : null,
        };
        w.t.crewMembers.push(row);
        w.audit("crew_member", row.id, "insert", null, snapshot(row));
        return row.id;
      });
      return { id };
    },

    async update(actor: Actor, crewMemberId: Id, input: Partial<CrewInput>): Promise<{ id: Id }> {
      requireEditor(c, actor);
      const m = requireCrew(crewMemberId);
      const next: CrewInput = {
        name: input.name ?? m.name,
        phone: input.phone !== undefined ? input.phone : m.phone,
        type: input.type ?? m.type,
        levelId: input.levelId !== undefined ? input.levelId : m.levelId,
        abn: input.abn !== undefined ? input.abn : m.abn,
        gstRegistered: input.gstRegistered ?? m.gstRegistered,
        activeFrom: input.activeFrom ?? m.activeFrom,
        activeTo: input.activeTo !== undefined ? input.activeTo : m.activeTo,
        defaultBasis: input.defaultBasis ?? m.defaultBasis,
        defaultUnit: input.defaultUnit !== undefined ? input.defaultUnit : m.defaultUnit,
      };
      checkCrew(c, next);
      write(c, actor, "crew_update", (w) => {
        const before = snapshot(m);
        Object.assign(m, next, {
          defaultUnit: next.defaultBasis === "per_unit" ? next.defaultUnit : null,
          updatedAt: w.at,
        });
        w.audit("crew_member", m.id, "update", before, snapshot(m));
      });
      return { id: m.id };
    },

    /**
     * A dated rate, optionally for one job (pay rules §1; history kept). The same person, basis, unit,
     * job and start date replaces that rate's amount rather than adding a twin. Existing logs keep
     * their snapshot — except original $0.00 "missing rate" logs (same basis and unit) not yet in an
     * approved pay run and not deleted, which take the rate §1 now resolves for their own job and
     * date, audited: that is how a missing rate is fixed before approval (§9). Adjustments are never
     * re-priced: they carry the difference from a locked original (§8), which keeps its $0.00 snapshot
     * when approved with the waiver, so the adjustment keeps it too.
     */
    async setRate(actor: Actor, input: RateInput): Promise<RateDto> {
      requireEditor(c, actor);
      const m = requireCrew(input.crewMemberId);
      if (input.projectId !== null && !c.ix.projects.has(input.projectId))
        throw invalid("Pick a job from the list, or leave it blank for the usual rate.");
      const unit = input.basis === "per_unit" ? input.unit : null;
      if (input.basis === "per_unit" && unit === null)
        throw invalid("Pick the unit this rate is for: m², lm or each.");
      const rateId = write(c, actor, "rate_set", (w) => {
        const same = w.t.rates.find(
          (r) =>
            r.crewMemberId === m.id &&
            r.basis === input.basis &&
            r.unit === unit &&
            r.projectId === input.projectId &&
            r.effectiveFrom === input.effectiveFrom,
        );
        let rate: RateRow;
        if (same) {
          w.audit(
            "rate",
            same.id,
            "update",
            { amountCents: same.amountCents },
            { amountCents: input.amountCents },
          );
          same.amountCents = input.amountCents;
          same.updatedAt = w.at;
          rate = same;
        } else {
          rate = { ...w.base(), ...input, unit };
          w.t.rates.push(rate);
          w.audit("rate", rate.id, "insert", null, snapshot(rate));
        }
        const rates = w.t.rates.filter((r) => r.crewMemberId === m.id);
        for (const log of w.t.workLogs) {
          if (
            log.crewMemberId !== m.id ||
            log.source === "adjustment" ||
            !log.missingRate ||
            log.payRunId !== null ||
            log.deletedAt !== null ||
            log.basis !== input.basis ||
            log.unit !== unit
          )
            continue;
          const cents = rateFor(rates, m.id, input.basis, unit, log.projectId, log.date);
          if (cents === null) continue;
          const before = { rateCents: log.rateCents, amountCents: log.amountCents };
          log.rateCents = cents;
          log.amountCents = amountOf(log.basis, cents, log);
          log.missingRate = false;
          log.updatedAt = w.at;
          w.audit("work_log", log.id, "update", before, { rateCents: cents, amountCents: log.amountCents });
        }
        return rate.id;
      });
      return rates(requireCrew(m.id)).find((r) => r.id === rateId)!;
    },
  };
}
