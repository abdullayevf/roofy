import { createHash, randomBytes } from "node:crypto";
import { addDays } from "@/domain/dates";
import { ledgerBalance } from "@/domain/ledger";
import { formatDecimal } from "@/lib/format";
import {
  DataError,
  type Actor,
  type BalanceRow,
  type ExportFile,
  type Id,
  type LedgerRow,
  type LedgerService,
  type PayLineDto,
  type PayPersonGroup,
  type PayRunListItem,
  type PayRunReview,
  type PayRunService,
  type PayoutInput,
  type Statement,
  type StatementLinkService,
  type StatementShare,
} from "../../contracts";
import type { RunLine, RunPerson } from "../figures";
import { forbidden, notFound, type FakeContext } from "./context";
import { ledgerRows } from "./crew";
import { toCsv } from "./reports";
import { conflict, dateText, invalid, requireApprover, write } from "./writes";

/** Statement links live 90 days (architecture §6). */
const LINK_DAYS = 90;

const BASIS_WORDS: Record<PayLineDto["basis"], string> = {
  hourly: "Hourly",
  daily: "Daily",
  per_unit: "Per unit",
  lump_sum: "Lump sum",
  time_only: "Time only",
};
const LABEL_WORDS = { normal: "", late: " (late entry)", adjustment: " (adjustment)" } as const;

/** Pay-run CSV columns a bookkeeper can key into Xero/MYOB. */
export const PAY_RUN_CSV_HEADER = [
  "Date",
  "Person",
  "ABN",
  "Job",
  "Stage",
  "Basis",
  "Qty",
  "Unit",
  "Hours",
  "Rate",
  "Amount",
  "GST",
  "Total",
];

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

    /**
     * Approve (Owner/Manager; pay rules §9): freezes every line of the draft as computed by the domain
     * (`buildPayRun`, contractor GST, reimbursements), locks the logs, marks crew-paid expenses
     * reimbursed and posts one ledger credit per person. Blocked while Owner 2FA is off, and by a
     * missing rate unless waived (audited). The oldest draft goes first. A draft for the following
     * period is opened if there isn't one, so late entries have somewhere to land.
     */
    async approve(
      actor: Actor,
      payRunId: Id,
      options?: { waiveMissingRate?: boolean },
    ): Promise<PayRunReview> {
      requireApprover(c, actor);
      const run = requireRun(payRunId);
      if (run.status !== "draft") throw conflict("This pay run is already approved.");
      const earlier = c.t.payRuns
        .filter((r) => r.status === "draft" && r.periodStart < run.periodStart)
        .sort((a, b) => a.periodStart.localeCompare(b.periodStart))[0];
      if (earlier) {
        throw conflict(
          `Approve the pay run for ${dateText(c, earlier.periodStart)} – ${dateText(c, earlier.periodEnd)} first.`,
        );
      }
      const f = c.fig.run(run.id);
      if (f.blockedBy.includes("owner_2fa_off"))
        throw conflict("Turn on two-factor before you approve a pay run.");
      const waived = f.blockedBy.includes("missing_rate");
      if (waived && !options?.waiveMissingRate) throw conflict("Fix the missing rate before you approve.");
      const today = c.today;
      write(c, actor, "pay_run_approve", (w) => {
        const logs = new Map(w.t.workLogs.map((l) => [l.id, l]));
        const expenses = new Map(w.t.expenses.map((e) => [e.id, e]));
        for (const p of f.people) {
          const line = { payRunId: run.id, crewMemberId: p.crew.id };
          for (const l of p.lines) {
            logs.get(l.logId)!.payRunId = run.id;
            w.t.payRunLines.push({
              ...line,
              ...w.base(),
              kind: "log",
              refId: l.logId,
              snapshot: {
                kind: "log",
                date: l.date,
                projectId: l.projectId,
                stageId: l.stageId,
                basis: l.basis,
                unit: l.unit,
                quantity: l.quantity,
                hours: l.hours,
                multiplier: l.multiplier,
                rateCents: l.rateCents,
                label: l.label,
              },
              amountCents: l.amountCents,
            });
          }
          for (const r of p.reimbursements) {
            expenses.get(r.expenseId)!.reimbursedInPayRunId = run.id;
            w.t.payRunLines.push({
              ...line,
              ...w.base(),
              kind: "reimbursement",
              refId: r.expenseId,
              snapshot: { kind: "reimbursement", date: r.date, projectId: r.projectId, supplier: r.supplier },
              amountCents: r.amountCents,
            });
          }
          if (p.totals.gstCents !== 0) {
            w.t.payRunLines.push({
              ...line,
              ...w.base(),
              kind: "gst",
              refId: null,
              snapshot: { kind: "gst", subtotalCents: p.totals.subtotalCents },
              amountCents: p.totals.gstCents,
            });
          }
          w.t.ledgerEntries.push({
            ...w.base(),
            crewMemberId: p.crew.id,
            date: today,
            kind: "payrun_credit",
            amountCents: p.totals.totalCents,
            method: null,
            note: null,
            payRunId: run.id,
          });
        }
        run.status = "approved";
        run.approvedBy = actor.userId;
        run.approvedAt = w.at;
        run.updatedAt = w.at;
        w.audit(
          "pay_run",
          run.id,
          "update",
          { status: "draft" },
          { status: "approved", waivedMissingRate: waived },
        );
        const nextStart = addDays(run.periodEnd, 1);
        if (!w.t.payRuns.some((r) => r.periodStart >= nextStart)) {
          const period = c.fig.periodContaining(nextStart);
          w.t.payRuns.push({
            ...w.base(),
            periodStart: period.start,
            periodEnd: period.end,
            status: "draft",
            approvedBy: null,
            approvedAt: null,
            exportedAt: null,
          });
        }
      });
      return review(actor, run.id);
    },

    /**
     * Reopen (Owner/Manager; pay rules §9) only while no later run is approved: deletes its ledger
     * credits and frozen lines, unlocks its logs and reimbursements. Audited.
     */
    async reopen(actor: Actor, payRunId: Id): Promise<PayRunReview> {
      requireApprover(c, actor);
      const run = requireRun(payRunId);
      if (run.status === "draft")
        throw conflict("This pay run isn't approved yet, so there's nothing to reopen.");
      if (c.t.payRuns.some((r) => r.status !== "draft" && r.periodStart > run.periodStart))
        throw conflict("A later pay run is approved. Reopen that one first.");
      write(c, actor, "pay_run_reopen", (w) => {
        const before = { status: run.status, approvedAt: run.approvedAt };
        w.t.ledgerEntries = w.t.ledgerEntries.filter(
          (e) => !(e.payRunId === run.id && e.kind === "payrun_credit"),
        );
        w.t.payRunLines = w.t.payRunLines.filter((l) => l.payRunId !== run.id);
        for (const l of w.t.workLogs) if (l.payRunId === run.id) l.payRunId = null;
        for (const e of w.t.expenses) if (e.reimbursedInPayRunId === run.id) e.reimbursedInPayRunId = null;
        run.status = "draft";
        run.approvedBy = null;
        run.approvedAt = null;
        run.exportedAt = null;
        run.updatedAt = w.at;
        w.audit("pay_run", run.id, "update", before, { status: "draft" });
      });
      return review(actor, run.id);
    },

    /**
     * CSV of an approved run (Owner, Manager, Accountant); marks it Exported (re-export allowed). One
     * row per line and reimbursement, then a "Total" row per person with subtotal, GST and total.
     */
    async exportCsv(actor: Actor, payRunId: Id): Promise<ExportFile> {
      if (!c.access(actor).canExport) throw forbidden();
      const run = requireRun(payRunId);
      if (run.status === "draft") throw conflict("Approve the pay run before you export it.");
      const f = c.fig.run(run.id);
      const money = (cents: number | null) => (cents === null ? null : formatDecimal(cents));
      const rows = f.people.flatMap((p) => {
        const who = [p.crew.name, p.crew.abn];
        return [
          ...p.lines.map((l) => {
            const d = lineDto(c, l);
            return [
              d.date,
              ...who,
              d.projectName,
              d.stageName,
              `${BASIS_WORDS[d.basis]}${LABEL_WORDS[d.label]}`,
              formatDecimal(d.quantity),
              d.unit,
              formatDecimal(d.hours),
              money(d.rateCents),
              money(d.amountCents),
              null,
              null,
            ];
          }),
          ...reimbursementDtos(c, p).map((r) => [
            r.date,
            ...who,
            r.projectName,
            null,
            `Reimbursement (${r.supplier})`,
            null,
            null,
            null,
            null,
            money(r.amountCents),
            null,
            null,
          ]),
          [
            f.period.end,
            ...who,
            null,
            null,
            "Total",
            null,
            null,
            formatDecimal(p.hours),
            null,
            money(p.totals.subtotalCents),
            money(p.totals.gstCents),
            money(p.totals.totalCents),
          ],
        ];
      });
      write(c, actor, "pay_run_export", (w) => {
        run.status = "exported";
        run.exportedAt = w.at;
        run.updatedAt = w.at;
      });
      return {
        filename: `pay-run-${f.period.start}-to-${f.period.end}.csv`,
        contentType: "text/csv; charset=utf-8",
        body: toCsv(PAY_RUN_CSV_HEADER, rows),
      };
    },

    /** A private statement link (Owner/Manager): 32 random bytes, stored hashed, 90 days (§6). */
    async shareStatement(actor: Actor, payRunId: Id, crewMemberId: Id): Promise<StatementShare> {
      requireApprover(c, actor);
      const run = requireRun(payRunId);
      if (run.status === "draft") throw conflict("Approve the pay run before you share statements.");
      if (!c.fig.run(run.id).people.some((p) => p.crew.id === crewMemberId)) throw notFound("statement");
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(c.now().getTime() + LINK_DAYS * 86_400_000).toISOString();
      write(c, actor, "statement_share", (w) => {
        w.t.statementLinks.push({
          ...w.base(),
          payRunId: run.id,
          crewMemberId,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt,
          revokedAt: null,
        });
      });
      return { token, path: `/s/${token}`, expiresAt };
    },
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

    /** Advance or payment (Owner/Manager; pay rules §15). Record only — no money moves. Audited. */
    async recordPayout(actor: Actor, input: PayoutInput): Promise<{ id: Id; balanceCents: number }> {
      requireApprover(c, actor);
      if (!c.ix.crew.has(input.crewMemberId)) throw notFound("crew member");
      if (input.amountCents <= 0) throw invalid("Add an amount before saving.");
      const id = write(c, actor, "payout", (w) => {
        const row = {
          ...w.base(),
          crewMemberId: input.crewMemberId,
          date: input.date,
          kind: input.kind,
          amountCents: input.amountCents,
          method: input.method,
          note: input.note,
          payRunId: null,
        };
        w.t.ledgerEntries.push(row);
        w.audit("ledger_entry", row.id, "insert", null, { kind: row.kind, amountCents: row.amountCents });
        return row.id;
      });
      return { id, balanceCents: c.fig.ledger(input.crewMemberId).balanceCents };
    },
  };
}
