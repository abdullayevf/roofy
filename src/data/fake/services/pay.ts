import { createHash } from "node:crypto";
import { ledgerBalance } from "@/domain/ledger";
import {
  DataError,
  type Actor,
  type BalanceRow,
  type Id,
  type LedgerRow,
  type LedgerService,
  type PayLineDto,
  type PayPersonGroup,
  type PayRunListItem,
  type PayRunReview,
  type PayRunService,
  type Statement,
  type StatementLinkService,
} from "../../contracts";
import type { RunLine, RunPerson } from "../figures";
import { notFound, notYet, type FakeContext } from "./context";
import { ledgerRows } from "./crew";

export function createPayRunService(c: FakeContext): PayRunService {
  function requireRun(runId: Id) {
    const run = c.ix.payRuns.get(runId);
    if (!run) throw notFound("pay run");
    return run;
  }

  function review(actor: Actor, runId: Id): PayRunReview {
    const access = c.access(actor);
    const run = requireRun(runId);
    const f = c.fig.run(run.id);
    const laterApproved = c.t.payRuns.some((r) => r.status !== "draft" && r.periodStart > run.periodStart);
    return {
      view: "manager",
      access,
      id: run.id,
      period: f.period,
      status: run.status,
      approvedAt: run.approvedAt,
      approvedByName: run.approvedBy === null ? null : c.memberName(run.approvedBy),
      exportedAt: run.exportedAt,
      flags: f.flags,
      people: f.people.map((p) => personGroup(c, p)),
      totals: f.totals,
      canApprove: access.canApprove && run.status === "draft" && f.blockedBy.length === 0,
      blockedBy: f.blockedBy,
      canReopen: access.canApprove && run.status !== "draft" && !laterApproved,
    };
  }

  return {
    async list(actor: Actor): Promise<PayRunListItem[]> {
      c.access(actor);
      return [...c.t.payRuns]
        .sort((a, b) => b.periodStart.localeCompare(a.periodStart))
        .map((run) => {
          const f = c.fig.run(run.id);
          return {
            id: run.id,
            period: f.period,
            status: run.status,
            totalCents: f.totals.totalCents,
            peopleCount: f.people.length,
            flagCount: f.flags.length,
            blocking: f.blockedBy.length > 0,
            approvedAt: run.approvedAt,
          };
        });
    },

    async get(actor: Actor, payRunId: Id): Promise<PayRunReview> {
      return review(actor, payRunId);
    },

    async draft(actor: Actor): Promise<PayRunReview | null> {
      c.access(actor);
      const run = c.fig.reviewRun();
      return run ? review(actor, run.id) : null;
    },

    async statement(actor: Actor, payRunId: Id, crewMemberId: Id): Promise<Statement> {
      c.access(actor);
      return statementOf(c, payRunId, crewMemberId);
    },

    approve: () => notYet("payRuns.approve"),
    reopen: () => notYet("payRuns.reopen"),
    exportCsv: () => notYet("payRuns.exportCsv"),
    shareStatement: () => notYet("payRuns.shareStatement"),
  };
}

function lineDto(c: FakeContext, l: RunLine): PayLineDto {
  return {
    logId: l.logId,
    date: l.date,
    projectId: l.projectId,
    projectName: c.ix.projects.get(l.projectId)!.nickname,
    stageId: l.stageId,
    stageName: c.ix.stages.get(l.stageId)!.name,
    basis: l.basis,
    unit: l.unit,
    quantity: l.quantity,
    hours: l.hours,
    multiplier: l.multiplier,
    rateCents: l.rateCents,
    amountCents: l.amountCents,
    label: l.label,
    missingRate: l.missingRate,
  };
}

function reimbursementDtos(c: FakeContext, p: RunPerson) {
  return p.reimbursements.map((r) => ({
    expenseId: r.expenseId,
    date: r.date,
    supplier: r.supplier,
    projectName: c.ix.projects.get(r.projectId)!.nickname,
    amountCents: r.amountCents,
  }));
}

function personGroup(c: FakeContext, p: RunPerson): PayPersonGroup {
  return {
    crewMemberId: p.crew.id,
    name: p.crew.name,
    type: p.crew.type,
    abn: p.crew.abn,
    gstRegistered: p.crew.gstRegistered,
    lines: p.lines.map((l) => lineDto(c, l)),
    reimbursements: reimbursementDtos(c, p),
    totals: p.totals,
    hours: p.hours,
    floor:
      p.floorRateCents === null
        ? null
        : {
            floorRateCents: p.floorRateCents,
            effectiveHourlyCents: p.floor?.effectiveHourlyCents ?? null,
            below: p.floor?.below ?? false,
            shortfallCents: p.floor?.shortfallCents ?? 0,
          },
    missingRate: p.missingRate,
  };
}

/** Pay rules §16, for one person in one run (no actor check: callers do that). */
function statementOf(c: FakeContext, payRunId: Id, crewMemberId: Id): Statement {
  const run = c.ix.payRuns.get(payRunId);
  if (!run) throw notFound("pay run");
  const f = c.fig.run(run.id);
  const p = f.people.find((x) => x.crew.id === crewMemberId);
  if (!p) throw notFound("statement");
  const ledger = c.ix.ledgerOf(crewMemberId);
  const entries = c.fig.ledger(crewMemberId).entries;
  let balanceAfterCents: number;
  if (run.status === "draft") {
    balanceAfterCents = ledgerBalance([
      ...entries,
      { date: c.today, kind: "payrun_credit", amountCents: p.totals.totalCents },
    ]);
  } else {
    const at = ledger.findIndex((e) => e.kind === "payrun_credit" && e.payRunId === run.id);
    balanceAfterCents = ledgerBalance(entries.slice(0, at + 1));
  }
  return {
    payRunId: run.id,
    business: { name: c.t.workspace.name, abn: c.t.workspace.abn },
    person: { id: p.crew.id, name: p.crew.name, type: p.crew.type, abn: p.crew.abn },
    period: f.period,
    lines: p.lines.map((l) => lineDto(c, l)),
    reimbursements: reimbursementDtos(c, p),
    totals: p.totals,
    payouts: ledger
      .filter((e) => e.kind !== "payrun_credit" && e.date >= f.period.start && e.date <= f.period.end)
      .map((e) => ({
        date: e.date,
        kind: e.kind as "advance" | "payment",
        amountCents: e.amountCents,
        method: e.method,
      })),
    balanceAfterCents,
    contractorFooter: p.crew.type === "contractor",
  };
}

export const EXPIRED_LINK = "This statement link has expired or been turned off. Ask for a new one.";

export function createStatementLinkService(c: FakeContext): StatementLinkService {
  return {
    /** The token is the permission (architecture §6): sha256 match, not revoked, not expired. */
    async open(token: string): Promise<Statement> {
      const hash = createHash("sha256").update(token).digest("hex");
      const link = c.t.statementLinks.find((l) => l.tokenHash === hash);
      if (!link || link.revokedAt !== null || link.expiresAt <= c.now().toISOString()) {
        throw new DataError("not_found", EXPIRED_LINK);
      }
      return statementOf(c, link.payRunId, link.crewMemberId);
    },
  };
}

export function createLedgerService(c: FakeContext): LedgerService {
  return {
    async balances(actor: Actor): Promise<BalanceRow[]> {
      c.access(actor);
      return c.t.crewMembers
        .map((m) => ({ m, ledger: c.fig.ledger(m.id) }))
        .filter(({ m, ledger }) => m.activeTo === null || ledger.balanceCents !== 0)
        .map(({ m, ledger }) => ({
          crewMemberId: m.id,
          name: m.name,
          type: m.type,
          balanceCents: ledger.balanceCents,
          oldestUnpaidDate: ledger.oldestUnpaidDate,
          unpaidTooLong: ledger.unpaidTooLong,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    async entries(actor: Actor, crewMemberId: Id): Promise<LedgerRow[]> {
      c.access(actor);
      if (!c.ix.crew.has(crewMemberId)) throw notFound("crew member");
      return ledgerRows(c, crewMemberId);
    },

    recordPayout: () => notYet("ledger.recordPayout"),
  };
}
