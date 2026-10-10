import Link from "next/link";
import { CaretRight, WarningDiamond } from "@phosphor-icons/react/dist/ssr";
import type { PayFlag, PayLineDto, PayPersonGroup, PayRunReview, ReimbursementDto, Role } from "@/data/contracts";
import { cx } from "@/lib/cx";
import { formatDate, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { LoadError } from "./field-entry";
import { COLUMN, FOCUS, GROUP, KeyFigure, KeyFigureSkeleton } from "./home-parts";
import { flagTarget, flagText, lineBasisParts, lineLabelText, personKindLines, personTotalRows } from "./pay-review-text";
import { payRunPeriodText, peopleCountText } from "./pay-runs-text";

const REVIEW_COLUMN = cx(COLUMN, "lg:max-w-none");
/** From 1024 px: the total, what to check and the run totals on the left; every person's lines on the right. */
const SPLIT = "flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start lg:gap-10";
/** A row's right column for its figure: as wide as the figure (even at 200% text), right-aligned; the words wrap. */
const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4";
const FIGURE = "block text-right text-figure num text-ink whitespace-nowrap";

type Reader = Exclude<Role, "foreman">;

function Top({ review, today }: { review: Pick<PayRunReview, "period" | "status" | "approvedByName" | "exportedAt">; today: string }) {
  return (
    <div className="flex flex-col gap-1">
      <Button variant="link" href="/pay" className="self-start">
        Back to pay runs
      </Button>
      <h1 className="text-title text-ink">Pay run</h1>
      <p data-pay-period="" className="text-body-strong text-ink">{payRunPeriodText(review.period, today)}</p>
      <StatusChip status={review.status} plain />
      {review.status !== "draft" && review.approvedByName ? (
        <p data-pay-approved="" className="text-meta text-ink">Approved by {review.approvedByName}</p>
      ) : null}
      {review.exportedAt ? <p className="text-meta text-ink">Exported to CSV</p> : null}
    </div>
  );
}

function FlagRow({ flag, today }: { flag: PayFlag; today: string }) {
  const href = flagTarget(flag);
  const body = (
    <>
      <WarningDiamond size={24} aria-hidden="true" className={cx("shrink-0", flag.blocking ? "text-over" : "text-watch")} />
      <span className="flex min-w-0 flex-col">
        <span className="text-body text-ink">{flagText(flag, today)}</span>
        <span className="text-meta text-ink">{flag.blocking ? "Stops approval" : "Check before you approve"}</span>
      </span>
    </>
  );
  const cls = "relative flex min-h-12 items-start gap-3 py-3 pl-4 pr-9";
  return (
    <li data-pay-flag={flag.blocking ? "blocking" : "warning"}>
      {href ? (
        <Link href={href} prefetch={false} className={cx(cls, "active:bg-galv first:rounded-t-group", FOCUS)}>
          {body}
          <CaretRight size={24} aria-hidden="true" className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-2" />
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}

function Flags({ flags, today }: { flags: PayFlag[]; today: string }) {
  return (
    <section aria-labelledby="pay-flags-title" className="flex flex-col gap-3">
      <h2 id="pay-flags-title" className="text-heading text-ink">To check</h2>
      {flags.length === 0 ? (
        <p className="text-body text-ink">Nothing to check in this pay run.</p>
      ) : (
        <ul data-pay-flags="" className={GROUP}>
          {flags.map((f, i) => (
            <FlagRow key={`${f.kind}-${f.crewMemberId ?? "run"}-${i}`} flag={f} today={today} />
          ))}
        </ul>
      )}
    </section>
  );
}

function FigureRow({ label, cents, strong = false, data }: { label: string; cents: number; strong?: boolean; data?: string }) {
  return (
    <div data-pay-sum={data} className={cx(ROW_GRID, "min-h-12 items-center px-4 py-2")}>
      <span className={strong ? "text-body-strong text-ink" : "text-body text-ink"}>{label}</span>
      <span className={FIGURE}>{formatMoney(cents)}</span>
    </div>
  );
}

function RunTotals({ totals }: { totals: PayRunReview["totals"] }) {
  return (
    <section aria-labelledby="pay-totals-title" data-pay-run-totals="" className="flex flex-col gap-3">
      <h2 id="pay-totals-title" className="text-heading text-ink">Pay run totals</h2>
      <div className={GROUP}>
        <FigureRow label="Employees" cents={totals.employeesCents} />
        <FigureRow label="Contractors" cents={totals.contractorsCents} />
        <FigureRow label="GST on contractors" cents={totals.gstCents} />
        <FigureRow label="Reimbursements" cents={totals.reimbursementsCents} />
        <FigureRow label="Total" cents={totals.totalCents} strong data="total" />
      </div>
    </section>
  );
}

function LineRow({ line, today }: { line: PayLineDto; today: string }) {
  const label = lineLabelText(line, today);
  const basis = lineBasisParts(line);
  return (
    <div id={`line-${line.logId}`} data-pay-line={line.label} className={cx(ROW_GRID, "min-h-12 scroll-mt-24 px-4 py-2 target:bg-galv")}>
      <span className="flex min-w-0 flex-col">
        <span className="text-body-strong text-ink">{formatDate(line.date, today)}</span>
        {label ? <span data-line-label="" className="text-body-strong text-ink">{label}</span> : null}
        <span className="text-meta text-ink">{line.projectName}</span>
        <span className="text-meta text-ink">{line.stageName}</span>
        <span data-line-basis="" className="text-meta text-ink">
          {basis.lead}
          {basis.rateCents === null ? null : <span className="text-figure num">{formatMoney(basis.rateCents)}</span>}
          {basis.tail}
        </span>
        {line.missingRate ? <span className="text-body-strong text-ink">Missing rate</span> : null}
      </span>
      <span data-line-amount="" className={FIGURE}>{formatMoney(line.amountCents)}</span>
    </div>
  );
}

function ReimbursementRow({ r, today }: { r: ReimbursementDto; today: string }) {
  return (
    <div data-pay-reimbursement="" className={cx(ROW_GRID, "min-h-12 px-4 py-2")}>
      <span className="flex min-w-0 flex-col">
        <span className="text-body-strong text-ink">Reimbursement</span>
        <span className="text-meta text-ink">{r.supplier}, {formatDate(r.date, today)}</span>
        <span className="text-meta text-ink">{r.projectName}</span>
      </span>
      <span className={FIGURE}>{formatMoney(r.amountCents)}</span>
    </div>
  );
}

function PersonGroup({ person, today }: { person: PayPersonGroup; today: string }) {
  const headingId = `crew-${person.crewMemberId}-name`;
  return (
    <section id={`crew-${person.crewMemberId}`} aria-labelledby={headingId} data-pay-person={person.type} className={cx(GROUP, "scroll-mt-24")}>
      <div className={cx(ROW_GRID, "px-4 py-3")}>
        <span className="flex min-w-0 flex-col">
          <h3 id={headingId} className="text-heading text-ink [overflow-wrap:anywhere]">{person.name}</h3>
          {personKindLines(person).map((t) => (
            <span key={t} className="text-meta text-ink">{t}</span>
          ))}
        </span>
        <span data-person-total="" className={FIGURE}>{formatMoney(person.totals.totalCents)}</span>
      </div>
      {person.lines.map((l) => (
        <LineRow key={l.logId} line={l} today={today} />
      ))}
      {person.reimbursements.map((r) => (
        <ReimbursementRow key={r.expenseId} r={r} today={today} />
      ))}
      <div data-person-totals="" className="py-1">
        {personTotalRows(person).map((row) => (
          <FigureRow key={row.label} label={row.label} cents={row.cents} strong={row.label === "Total"} />
        ))}
      </div>
    </section>
  );
}

export type PayRunReviewProps = { review: PayRunReview; role: Reader; today: string };

/** Pay run review (flows.md screen 19), display: flags first, then each person's lines and totals, then the run totals. */
export function PayRunReviewBody({ review, today }: PayRunReviewProps) {
  return (
    <div data-screen="pay-run-review" className={REVIEW_COLUMN}>
      <Top review={review} today={today} />
      <div className={SPLIT}>
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-1">
            <KeyFigure>{formatMoney(review.totals.totalCents)}</KeyFigure>
            <p data-pay-people="" className="text-meta text-ink">{peopleCountText(review.people.length)} in this pay run</p>
          </div>
          <Flags flags={review.flags} today={today} />
          <RunTotals totals={review.totals} />
          {/* Approve, Export CSV and Reopen land here (Task 17 run C). */}
          <div data-pay-actions="" hidden />
        </div>
        <section aria-labelledby="pay-people-title" className="flex flex-col gap-3">
          <h2 id="pay-people-title" className="text-heading text-ink">People</h2>
          {review.people.length === 0 ? <p className="text-body text-ink">No one is in this pay run yet.</p> : null}
          {review.people.map((p) => (
            <PersonGroup key={p.crewMemberId} person={p} today={today} />
          ))}
        </section>
      </div>
    </div>
  );
}

/** The review when the server can't answer: the back row and title stay, Try again is the one primary button. */
export function PayRunReviewError() {
  return (
    <div data-screen="pay-run-review" className={REVIEW_COLUMN}>
      <div className="flex flex-col gap-1">
        <Button variant="link" href="/pay" className="self-start">
          Back to pay runs
        </Button>
        <h1 className="text-title text-ink">Pay run</h1>
      </div>
      <LoadError primary />
    </div>
  );
}

function LineSkeleton() {
  return (
    <div className={cx(ROW_GRID, "px-4 py-2")}>
      <div className="flex flex-col">
        <div className="flex h-6 items-center"><Skeleton width={96} height={18} /></div>
        {[150, 120, 160].map((w) => (
          <div key={w} className="flex h-5 items-center"><Skeleton width={w} height={14} /></div>
        ))}
      </div>
      <div className="flex h-6 items-center justify-end"><Skeleton width={80} height={20} /></div>
    </div>
  );
}

/** The review while it loads (`?demo=loading`): the back row, title, figure, flags and a person's lines as same-size blocks. */
export function PayRunReviewSkeleton() {
  return (
    <div data-screen="pay-run-review" aria-busy="true" className={REVIEW_COLUMN}>
      <div className="flex flex-col gap-1">
        <Button variant="link" href="/pay" className="self-start">
          Back to pay runs
        </Button>
        <h1 className="text-title text-ink">Pay run</h1>
        <div className="flex h-6 items-center"><Skeleton width={180} height={20} /></div>
        <div className="flex h-6 items-center"><Skeleton width={84} height={16} /></div>
      </div>
      <div className={SPLIT}>
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-1">
            <KeyFigureSkeleton width={200} />
            <div className="flex h-5 items-center"><Skeleton width={150} height={14} /></div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex h-7 items-center"><Skeleton width={110} height={22} /></div>
            <div className={GROUP}>
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex min-h-12 items-center gap-3 px-4 py-3">
                  <Skeleton width={24} height={24} />
                  <Skeleton width={240} height={16} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex h-7 items-center"><Skeleton width={90} height={22} /></div>
          <div className={GROUP}>
            <div className="flex h-16 items-center justify-between px-4"><Skeleton width={120} height={22} /><Skeleton width={96} height={22} /></div>
            {Array.from({ length: 4 }, (_, i) => (
              <LineSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
