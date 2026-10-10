import type { Statement } from "@/data/contracts";
import { cx } from "@/lib/cx";
import { formatDate, formatMoney } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { statementPeriodText } from "./crew-detail-text";
import { LoadError } from "./field-entry";
import { GROUP, KeyFigure } from "./home-parts";
import { foldTimeOnlyLines, personTotalRows } from "./pay-review-text";
import { FIGURE, FigureRow, LineRow, ROW_GRID, ReimbursementRow } from "./pay-run-review";
import { StatementShareButton } from "./statement-share-button";
import { STATEMENT_GONE, statementBalance, statementEarlier, statementFooter, statementPayoutText } from "./statement-text";

/**
 * The public statement page's frame (flows.md screen 21): no app nav, no tab bar, one readable column; safe-area
 * padding on phones, plain on paper.
 */
export function StatementFrame({ children }: { children: React.ReactNode }) {
  return (
    <main
      data-screen="crew-statement"
      className="min-h-dvh px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] lg:py-12 print:p-0"
    >
      <div className="mx-auto flex w-full max-w-180 flex-col gap-8 lg:max-w-6xl">{children}</div>
    </main>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 print:break-inside-avoid">
      <h2 id={id} className="text-heading text-ink">
        {title}
      </h2>
      <div className={cx(GROUP, "print:border-line")}>{children}</div>
    </section>
  );
}

/** One person's statement for one approved pay run (pay rules §16). Read-only; Share hands on this page's link. */
export function CrewStatement({ statement: s, today }: { statement: Statement; today: string }) {
  const footer = statementFooter(s);
  const balance = statementBalance(s.balanceAfterCents);
  const earlier = statementEarlier(s.balanceBeforeCents);
  const paidCents = s.payouts.reduce((a, p) => a + p.amountCents, 0);
  return (
    <StatementFrame>
      <header className="flex flex-col gap-4">
        <div className="flex flex-col">
          <p data-statement-business="" className="text-body-strong text-ink">
            {s.business.name}
          </p>
          <p className="text-meta text-ink">ABN {s.business.abn}</p>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-title text-ink">Pay statement</h1>
          <p className="text-heading text-ink [overflow-wrap:anywhere]">{s.person.name}</p>
          <p className="text-meta text-ink">
            {s.person.type === "contractor"
              ? s.person.abn
                ? `Contractor, ABN ${s.person.abn}`
                : "Contractor"
              : "Employee"}
          </p>
          <p data-statement-period="" className="text-body text-ink">
            {statementPeriodText(s.period, today)}
          </p>
        </div>
        <div data-statement-key="" className="flex flex-col">
          <p className="text-body-strong text-ink">{balance.label}</p>
          <KeyFigure>{formatMoney(balance.cents)}</KeyFigure>
        </div>
        <StatementShareButton />
      </header>

      {/* From 1024 px: the work on the right, the totals, payouts, balance and footer beside it (one column on paper). */}
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start lg:gap-10 print:flex">
        <div data-statement-work="" className="lg:col-start-2 lg:row-start-1">
          <Section id="statement-work" title="Work">
            {s.lines.length === 0 ? (
              <p className="px-4 py-3 text-body text-ink">No work in this pay run.</p>
            ) : null}
            {foldTimeOnlyLines(s.lines).map((r) => (
              <LineRow key={r.line.logId} line={r.line} today={today} loggedHours={r.loggedHours} foldedIds={r.foldedIds} />
            ))}
            {s.reimbursements.map((r) => (
              <ReimbursementRow key={r.expenseId} r={r} today={today} />
            ))}
          </Section>
        </div>

        <div data-statement-summary="" className="flex flex-col gap-8 lg:col-start-1 lg:row-start-1">
          <Section id="statement-totals" title="Totals">
            {personTotalRows({ type: s.person.type, totals: s.totals }).map((row, i, rows) => (
              <FigureRow
                key={row.label}
                label={row.label}
                cents={row.cents}
                strong={i === rows.length - 1}
                data={i === rows.length - 1 ? "total" : undefined}
              />
            ))}
          </Section>

          {s.payouts.length > 0 ? (
            <Section id="statement-payouts" title="Paid to you">
              {s.payouts.map((p, i) => (
                <div
                  key={`${p.date}-${i}`}
                  data-statement-payout=""
                  className={cx(ROW_GRID, "min-h-12 items-center px-4 py-2")}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="text-body-strong text-ink">{statementPayoutText(p)}</span>
                    <span className="text-meta text-ink">{formatDate(p.date, today)}</span>
                  </span>
                  <span className={FIGURE}>{formatMoney(p.amountCents)}</span>
                </div>
              ))}
            </Section>
          ) : null}

          {/* Adds up by hand: owed from earlier + this pay run − paid = what's owed now (pay rules §16). */}
          <Section id="statement-balance" title="Balance">
            <div data-statement-balance="">
              <FigureRow label={earlier.label} cents={earlier.cents} data="earlier" />
              <FigureRow label="This pay run" cents={s.totals.totalCents} data="run" />
              <FigureRow label="Paid to you" cents={paidCents} data="paid" />
              <FigureRow label={balance.label} cents={balance.cents} strong data="balance" />
            </div>
          </Section>

          {footer ? (
            <p data-statement-footer="" className="text-body text-ink">
              {footer}
            </p>
          ) : null}
        </div>
      </div>
    </StatementFrame>
  );
}

/** Expired, turned off or unknown: a plain page with one sentence and nothing else. */
export function StatementGone() {
  return (
    <StatementFrame>
      <h1 className="text-title text-ink">Statement not available</h1>
      <p data-statement-gone="" className="text-body text-ink">
        {STATEMENT_GONE}
      </p>
    </StatementFrame>
  );
}

export function StatementError() {
  return (
    <StatementFrame>
      <h1 className="text-title text-ink">Pay statement</h1>
      <LoadError primary />
    </StatementFrame>
  );
}

/** While it loads: shaped like the page: the header with its key figure and Share, then work rows of four lines. */
export function StatementSkeleton() {
  return (
    <StatementFrame>
      <div aria-busy="true" data-statement-skeleton="" className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Skeleton width={160} height={20} />
            <Skeleton width={140} height={16} />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton width={200} height={28} />
            <Skeleton width={180} height={20} />
            <Skeleton width={100} height={16} />
            <Skeleton width={220} height={20} />
          </div>
          <div className="flex flex-col gap-1">
            <Skeleton width={150} height={20} />
            <Skeleton width={200} height={44} />
          </div>
          <Skeleton width={120} height={52} />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton width={80} height={24} />
          <div className={GROUP}>
            {[0, 1, 2].map((i) => (
              <div key={i} data-skeleton-row="" className={cx(ROW_GRID, "min-h-12 px-4 py-2")}>
                <span className="flex flex-col gap-1">
                  <Skeleton width={100} height={20} />
                  <Skeleton width={140} height={16} />
                  <Skeleton width={160} height={16} />
                  <Skeleton width={180} height={16} />
                </span>
                <Skeleton width={80} height={20} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </StatementFrame>
  );
}
