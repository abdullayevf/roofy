import { WarningDiamond } from "@phosphor-icons/react/dist/ssr";
import type { PayFlag, PayRunListItem, Role } from "@/data/contracts";
import { cx } from "@/lib/cx";
import { formatMoney } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { LoadError } from "./field-entry";
import { COLUMN, GROUP, KeyFigure, KeyFigureSkeleton } from "./home-parts";
import { PayRunRows } from "./pay-runs-rows";
import { draftFlagsText, payRunPeriodText, peopleCountText, splitRuns } from "./pay-runs-text";

/** Left-aligned from 1024 px, where the draft and the list sit side by side. */
const PAY_COLUMN = cx(COLUMN, "lg:max-w-none");
/** Two columns from 1024 px: the draft to review on the left, every other run on the right. */
const SPLIT = "flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start lg:gap-10";

/** A phone row's fixed right column (same as the rows in pay-runs-rows.tsx, a client file, so the value can't be imported). */
const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_min(8.5rem,40%)] items-start gap-x-4";

type Reader = Exclude<Role, "foreman">;

function Header() {
  return (
    <div className="flex min-h-12 items-center">
      <h1 className="text-title text-ink">Pay runs</h1>
    </div>
  );
}

/** The draft to review now: period, total, who is in it, what to check, and the one primary action. */
function ReviewCard({ run, flags, role, today }: { run: PayRunListItem; flags: PayFlag[]; role: Reader; today: string }) {
  const blocked = flags.some((f) => f.blocking);
  return (
    <section aria-labelledby="pay-review-title" data-pay-review="" className="flex flex-col gap-4 rounded-group border-group bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 id="pay-review-title" className="text-heading text-ink">To review</h2>
        <p data-pay-period="" className="text-body-strong text-ink">{payRunPeriodText(run.period, today)}</p>
        <StatusChip status={run.status} plain />
      </div>
      <div className="flex flex-col gap-1">
        <KeyFigure>{formatMoney(run.totalCents)}</KeyFigure>
        <p data-pay-people="" className="text-meta text-ink">{peopleCountText(run.peopleCount)} in this pay run</p>
      </div>
      <p data-pay-flags={blocked ? "blocking" : "warning"} className="flex items-start gap-2 text-body text-ink">
        {flags.length > 0 ? <WarningDiamond size={24} aria-hidden="true" className={cx("shrink-0", blocked ? "text-over" : "text-watch")} /> : null}
        {draftFlagsText(flags, role)}
      </p>
      {/* Reading stays open offline (lesson 28); Approve, Reopen and Export on the review say "Needs connection". */}
      <Button variant="primary" href={`/pay/${run.id}`} className="w-full sm:w-auto sm:min-w-60 sm:self-start">
        {role === "accountant" ? "Open pay run" : "Review pay run"}
      </Button>
    </section>
  );
}

export type PayRunsListProps = {
  runs: PayRunListItem[];
  /** The draft to review now (oldest unapproved period), or null. */
  reviewId: string | null;
  reviewFlags: PayFlag[];
  role: Reader;
  /** The workspace's local date, for "Mon 21 Sep to Sun 27 Sep". */
  today: string;
};

/** Pay runs list (flows.md screen 18). Props only; the page fetches. */
export function PayRunsListBody({ runs, reviewId, reviewFlags, role, today }: PayRunsListProps) {
  if (runs.length === 0) {
    return (
      <div data-screen="pay-runs" className={PAY_COLUMN}>
        <Header />
        <div className="flex min-h-[50dvh] flex-col justify-center">
          {role === "accountant" ? (
            <EmptyState message="No pay runs yet. They show here once the crew logs work." />
          ) : (
            <EmptyState message="No pay runs yet. A pay run starts when the crew logs work." actionLabel="Log a crew-day" href="/log" />
          )}
        </div>
      </div>
    );
  }
  const { review, others } = splitRuns(runs, reviewId);
  return (
    <div data-screen="pay-runs" className={PAY_COLUMN}>
      <Header />
      <div className={SPLIT}>
        {review ? (
          <ReviewCard run={review} flags={reviewFlags} role={role} today={today} />
        ) : (
          <p className="text-body text-ink">Nothing to review. Every past pay run is approved.</p>
        )}
        {others.length > 0 ? (
          <section aria-labelledby="pay-others-title" className="flex flex-col gap-3">
            <h2 id="pay-others-title" className="text-heading text-ink">{review ? "Other pay runs" : "All pay runs"}</h2>
            <PayRunRows runs={others} today={today} />
          </section>
        ) : null}
      </div>
    </div>
  );
}

/** The list when the server can't answer: the title stays and Try again is the one primary button. */
export function PayRunsError() {
  return (
    <div data-screen="pay-runs" className={PAY_COLUMN}>
      <Header />
      <LoadError primary />
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="min-h-16 px-4 py-2">
      <div className={ROW_GRID}>
        <div className="flex flex-col">
          <div className="flex h-6 items-center"><Skeleton width={180} height={20} /></div>
          <div className="flex h-6 items-center"><Skeleton width={84} height={16} /></div>
          <div className="flex h-5 items-center"><Skeleton width={72} height={14} /></div>
        </div>
        <div className="flex h-6 items-center justify-end"><Skeleton width={96} height={22} /></div>
      </div>
    </div>
  );
}

/** The list while it loads (`?demo=loading`): the real title, the draft card and rows as blocks of the same size. */
export function PayRunsSkeleton() {
  return (
    <div data-screen="pay-runs" aria-busy="true" className={PAY_COLUMN}>
      <Header />
      <div className={SPLIT}>
        <div className="flex flex-col gap-4 rounded-group border-group bg-surface p-4">
          <div className="flex flex-col gap-1">
            <div className="flex h-7 items-center"><Skeleton width={110} height={22} /></div>
            <div className="flex h-6 items-center"><Skeleton width={180} height={20} /></div>
            <div className="flex h-6 items-center"><Skeleton width={84} height={16} /></div>
          </div>
          <div className="flex flex-col gap-1">
            <KeyFigureSkeleton width={200} />
            <div className="flex h-5 items-center"><Skeleton width={150} height={14} /></div>
          </div>
          <div className="flex h-12 items-center"><Skeleton width={260} height={16} /></div>
          <Skeleton height={52} className="w-full sm:w-60" />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex h-7 items-center"><Skeleton width={150} height={22} /></div>
          <div className={cx(GROUP, "overflow-hidden")}>
            {Array.from({ length: 5 }, (_, i) => (
              <RowSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
