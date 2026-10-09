import { Phone } from "@phosphor-icons/react/dist/ssr";
import type { CrewDetail } from "@/data/contracts";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/format";
import { KeepTogether } from "@/components/keep-together";
import { Button } from "@/components/ui/button";
import { List, type ListRow } from "@/components/ui/list";
import { MoneyCell } from "@/components/ui/money-cell";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadError } from "./field-entry";
import { COLUMN, GROUP, KeyFigure, KeyFigureSkeleton, Section } from "./home-parts";
import { balanceSentence, headerLines, ledgerEntry, phoneHref, rateRows, utilisationText } from "./crew-detail-text";
import { balanceView, payBasisLabel } from "./crew-input";
import { SeeAll } from "./job-detail";
import { logQuantityText } from "./job-detail-text";
import { JobsAddBar, OnlineOnlyHeadButton } from "./jobs-add-bar";
import { SavedToast } from "./saved-toast";
import { StatementList } from "./statement-list";

/** How many ledger lines and logs show before the link to the full history. */
const SHOWN = 6;

const historyHref = (id: string) => `/history?crew=${id}`;
const payoutHref = (id: string) => `/crew/${id}/payout`;

/** Back row and the name; from 1024 px the Record payout button sits in the title row (on a phone it is pinned at the bottom). */
function Header({ crew, demoOffline }: { crew: CrewDetail; demoOffline: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <Button variant="link" href="/crew" className="self-start">
        Back to crew
      </Button>
      <div className="flex items-start justify-between gap-4">
        <h1 data-crew-title="" className="text-title text-ink [overflow-wrap:anywhere]">
          <KeepTogether text={crew.name} />
        </h1>
        {crew.access.canApprove ? (
          <div className="jobs-add-head hidden shrink-0 lg:block">
            <OnlineOnlyHeadButton label="Record payout" href={payoutHref(crew.id)} demoOffline={demoOffline} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Who they are, one fact per line, then how they are paid, since when, and Call. Under the balance, not above it. */
function Identity({ crew, today }: { crew: CrewDetail; today: string }) {
  const util = utilisationText(crew.utilisation);
  const lines = [...headerLines(crew, today), payBasisLabel(crew.defaultBasis, crew.defaultUnit), `Active from ${formatDate(crew.activeFrom, today)}`];
  return (
    <div className="flex flex-col gap-2">
      <div data-crew-who="" className="flex flex-col text-meta text-ink-2 [overflow-wrap:anywhere]">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
        {util ? <p>{util}</p> : null}
      </div>
      {crew.phone ? (
        <Button variant="secondary" href={phoneHref(crew.phone)} className="self-start">
          <span className="inline-flex items-center gap-2">
            <Phone size={24} aria-hidden="true" />
            Call {crew.phone}
          </span>
        </Button>
      ) : null}
    </div>
  );
}

/** What they are owed (or were paid ahead), as one figure with its plain word and one sentence. */
function Balance({ crew, today }: { crew: CrewDetail; today: string }) {
  const b = balanceView(crew.balanceCents);
  const unpaid =
    crew.unpaidTooLong && crew.oldestUnpaidDate ? { since: crew.oldestUnpaidDate, payRuns: crew.unpaidPayRuns } : null;
  return (
    <div data-crew-balance={b.kind} className="flex flex-col gap-1">
      <p className="text-meta text-ink">{b.word}</p>
      <KeyFigure>{b.amount}</KeyFigure>
      <p className="text-body text-ink">{balanceSentence(crew.name, crew.balanceCents, unpaid, today)}</p>
    </div>
  );
}

function Ledger({ crew, today }: { crew: CrewDetail; today: string }) {
  const rows: ListRow[] = crew.ledger.slice(0, SHOWN).map((l) => {
    const e = ledgerEntry(l, today);
    return { key: e.key, primary: e.primary, meta: e.meta, figure: <MoneyCell cents={e.cents} /> };
  });
  return (
    <Section title="Pay and payments">
      {rows.length === 0 ? (
        <p data-empty="ledger" className="text-body text-ink">No pay or payments yet.</p>
      ) : (
        <>
          <List rows={rows} />
          {crew.ledger.length > SHOWN ? (
            <div className={GROUP}>
              <SeeAll href={historyHref(crew.id)} label="See all pay and payments" />
            </div>
          ) : null}
        </>
      )}
    </Section>
  );
}

function Statements({ crew, today, demoOffline }: { crew: CrewDetail; today: string; demoOffline: boolean }) {
  return (
    <Section title="Statements">
      {crew.statements.length === 0 ? (
        <p data-empty="statements" className="text-body text-ink">No statements yet. One appears once a pay run is approved.</p>
      ) : (
        <StatementList statements={crew.statements} crewMemberId={crew.id} today={today} demoOffline={demoOffline} />
      )}
    </Section>
  );
}

function Rates({ crew, today }: { crew: CrewDetail; today: string }) {
  const rows: ListRow[] = rateRows(crew.rates, today).map((r) => ({
    key: r.key,
    primary: r.primary,
    meta: r.meta,
    figure: <MoneyCell cents={r.cents} />,
  }));
  return (
    <Section title="Rates">
      {rows.length === 0 ? (
        <p data-empty="rates" className="text-body text-ink">No rates yet. Work logged without a rate is paid $0.00 until one is set.</p>
      ) : (
        <List rows={rows} />
      )}
    </Section>
  );
}

function RecentLogs({ crew, today }: { crew: CrewDetail; today: string }) {
  const rows: ListRow[] = crew.recentLogs.slice(0, SHOWN).map((l) => ({
    key: l.id,
    primary: l.projectName,
    meta: `${l.stageName}\n${formatDate(l.date, today)}, ${logQuantityText(l)}${l.amountCents === 0 ? ", time only" : ""}`,
    ...(l.amountCents === 0 ? {} : { figure: <MoneyCell cents={l.amountCents} /> }),
    href: historyHref(crew.id),
  }));
  return (
    <Section title="Recent logs">
      {rows.length === 0 ? (
        <p data-empty="logs" className="text-body text-ink">No work logged yet.</p>
      ) : (
        <>
          <List rows={rows} />
          {crew.recentLogs.length > SHOWN ? (
            <div className={GROUP}>
              <SeeAll href={historyHref(crew.id)} label="See all logs" />
            </div>
          ) : null}
        </>
      )}
    </Section>
  );
}

/**
 * Crew member detail (flows.md screen 15, manager only): who they are, what they are owed, the pay and payments behind
 * it, their statements (Share), their rates and recent work. Record payout is the one primary button. Props only.
 */
export function CrewDetailBody({
  crew,
  today,
  demoOffline = false,
  savedToast = null,
}: {
  crew: CrewDetail;
  today: string;
  demoOffline?: boolean;
  /** "Payment saved." after Record payout; the balance above already includes it. */
  savedToast?: string | null;
}) {
  return (
    <div data-screen="crew-detail" className={cx(COLUMN, "gap-4 lg:max-w-none lg:gap-6")}>
      <Header crew={crew} demoOffline={demoOffline} />
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10 lg:gap-y-10">
        <div className="flex min-w-0 flex-col gap-8 lg:gap-10">
          <Balance crew={crew} today={today} />
          <Identity crew={crew} today={today} />
          <Ledger crew={crew} today={today} />
        </div>
        <div className="flex min-w-0 flex-col gap-8 lg:gap-10">
          <Statements crew={crew} today={today} demoOffline={demoOffline} />
          <Rates crew={crew} today={today} />
          <RecentLogs crew={crew} today={today} />
        </div>
      </div>
      {crew.access.canApprove ? <JobsAddBar label="Record payout" href={payoutHref(crew.id)} needsConnection demoOffline={demoOffline} /> : null}
      {savedToast ? <SavedToast message={savedToast} /> : null}
    </div>
  );
}

/** A server failure: the back row stays, the body says so and offers Try again as the one primary button. */
export function CrewDetailError() {
  return (
    <div data-screen="crew-detail" className={COLUMN}>
      <Button variant="link" href="/crew" className="self-start">
        Back to crew
      </Button>
      <LoadError primary />
    </div>
  );
}

/** One list row's shape while it loads: a label, `lines` lines under it, and a figure on the right (the real rows' heights). */
function RowSkel({ lines }: { lines: number }) {
  return (
    <div className="flex min-h-16 items-start justify-between gap-4 px-4 py-2">
      <div className="flex flex-col gap-1">
        <Skeleton width={150} height={20} />
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} width={i === lines - 1 ? 150 : 210} height={14} />
        ))}
      </div>
      <Skeleton width={88} height={20} />
    </div>
  );
}

/** The page while it loads (`?demo=loading`): the same blocks as grey shapes, as tall as the real rows, with the pinned bar. */
export function CrewDetailSkeleton() {
  return (
    <div data-screen="crew-detail" aria-busy="true" className={cx(COLUMN, "gap-4 lg:max-w-none lg:gap-6")}>
      <div className="flex flex-col gap-2">
        <Button variant="link" href="/crew" className="self-start">
          Back to crew
        </Button>
        <div className="flex h-9 items-center">
          <Skeleton width={200} height={28} />
        </div>
      </div>
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10 lg:gap-y-10">
        <div className="flex min-w-0 flex-col gap-8 lg:gap-10">
          <div className="flex flex-col gap-1">
            <Skeleton width={96} height={14} />
            <KeyFigureSkeleton width={160} />
            <Skeleton width={260} height={20} />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton width={160} height={14} />
            <Skeleton width={120} height={14} />
            <Skeleton width={200} height={14} />
            <Skeleton width={180} height={52} />
          </div>
          <SkeletonSection rows={3} lines={2} />
        </div>
        <div className="flex min-w-0 flex-col gap-8 lg:gap-10">
          <SkeletonSection rows={2} lines={1} />
          <SkeletonSection rows={2} lines={1} />
        </div>
      </div>
      <JobsAddBar skeleton />
    </div>
  );
}

function SkeletonSection({ rows, lines }: { rows: number; lines: number }) {
  return (
    <section className="flex flex-col gap-2">
      <Skeleton width={120} height={24} />
      <div className={cx(GROUP, "overflow-hidden")}>
        {Array.from({ length: rows }, (_, i) => (
          <RowSkel key={i} lines={lines} />
        ))}
      </div>
    </section>
  );
}
