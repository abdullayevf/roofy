import Link from "next/link";
import { CaretRight, WarningDiamond } from "@phosphor-icons/react/dist/ssr";
import type { PayFlag, PayRunListItem, Role } from "@/data/contracts";
import { cx } from "@/lib/cx";
import { formatMoney } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { LoadError } from "./field-entry";
import { COLUMN, FOCUS, GROUP, KeyFigure, KeyFigureSkeleton } from "./home-parts";
import { PayReviewButton } from "./pay-review-button";
import { draftFlagsText, payRunPeriodText, peopleCountText, splitRuns } from "./pay-runs-text";
import { TD, TH } from "./table-cells";

/** Left-aligned from 1024 px, where the draft and the list sit side by side. */
const PAY_COLUMN = cx(COLUMN, "lg:max-w-none");
/** Two columns from 1024 px: the draft to review on the left, every other run on the right. */
const SPLIT = "flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start lg:gap-10";
/** A phone row's fixed right column: the total, right-aligned, never squeezed by the period. */
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
function ReviewCard({ run, flags, role, today, demoOffline }: { run: PayRunListItem; flags: PayFlag[]; role: Reader; today: string; demoOffline: boolean }) {
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
      <PayReviewButton label={role === "accountant" ? "Open pay run" : "Review pay run"} href={`/pay/${run.id}`} demoOffline={demoOffline} />
    </section>
  );
}

function Total({ run }: { run: PayRunListItem }) {
  return <span data-pay-total="" className="block text-right text-figure num text-ink whitespace-nowrap">{formatMoney(run.totalCents)}</span>;
}

/** A phone or tablet row: period, status and people on the left, the total in the right column. */
function PhoneRow({ run, today }: { run: PayRunListItem; today: string }) {
  return (
    <Link
      href={`/pay/${run.id}`}
      prefetch={false}
      data-pay-row=""
      className={cx("relative block min-h-16 py-2 pl-4 pr-9 first:rounded-t-group last:rounded-b-group active:bg-galv", FOCUS)}
    >
      <span className={ROW_GRID}>
        <span className="flex flex-col">
          <span data-pay-period="" className="text-body-strong text-ink">{payRunPeriodText(run.period, today)}</span>
          <StatusChip status={run.status} plain />
          <span className="text-meta text-ink">{peopleCountText(run.peopleCount)}</span>
        </span>
        <Total run={run} />
      </span>
      <CaretRight size={24} aria-hidden="true" className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-2" />
    </Link>
  );
}

/** From 1024 px, a table with the whole row as the link: period, status, people, total. */
function RunsTable({ runs, today }: { runs: PayRunListItem[]; today: string }) {
  return (
    <table className="hidden w-full lg:table">
      <thead>
        <tr>
          <th scope="col" className={TH}>Period</th>
          <th scope="col" className={TH}>Status</th>
          <th scope="col" className={TH}>People</th>
          <th scope="col" className={cx(TH, "text-right")}>Total</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {runs.map((run) => (
          <tr key={run.id} data-pay-row="" className="relative h-14 hover:bg-galv">
            <td className={TD}>
              <Link href={`/pay/${run.id}`} prefetch={false} className={cx("block text-body-strong text-ink after:absolute after:inset-0", FOCUS)}>
                {payRunPeriodText(run.period, today)}
              </Link>
            </td>
            <td className={TD}>
              <StatusChip status={run.status} plain />
            </td>
            <td className={cx(TD, "text-body text-ink")}>{peopleCountText(run.peopleCount)}</td>
            <td className={cx(TD, "pr-4")}>
              <Total run={run} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
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
  demoOffline?: boolean;
};

/** Pay runs list (flows.md screen 18). Props only; the page fetches. */
export function PayRunsListBody({ runs, reviewId, reviewFlags, role, today, demoOffline = false }: PayRunsListProps) {
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
          <ReviewCard run={review} flags={reviewFlags} role={role} today={today} demoOffline={demoOffline} />
        ) : (
          <p className="text-body text-ink">Nothing to review. Every past pay run is approved.</p>
        )}
        {others.length > 0 ? (
          <section aria-labelledby="pay-others-title" className="flex flex-col gap-3">
            <h2 id="pay-others-title" className="text-heading text-ink">{review ? "Other pay runs" : "All pay runs"}</h2>
            <div className={cx(GROUP, "overflow-hidden")}>
              <div className="divide-y divide-line lg:hidden">
                {others.map((run) => (
                  <PhoneRow key={run.id} run={run} today={today} />
                ))}
              </div>
              <RunsTable runs={others} today={today} />
            </div>
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
