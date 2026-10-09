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
import { balanceSentence, headerLine, ledgerEntry, phoneHref, rateRows, utilisationText } from "./crew-detail-text";
import { balanceView, payBasisLabel } from "./crew-input";
import { SeeAll } from "./job-detail";
import { logQuantityText } from "./job-detail-text";
import { JobsAddBar } from "./jobs-add-bar";
import { SavedToast } from "./saved-toast";
import { StatementRow } from "./statement-row";

/** How many ledger lines and logs show before the link to the full history. */
const SHOWN = 6;

const historyHref = (id: string) => `/history?crew=${id}`;
const payoutHref = (id: string) => `/crew/${id}/payout`;

/** Back row, the name, who they are, and from 1024 px the Record payout button (on a phone it is pinned at the bottom). */
function Header({ crew, today }: { crew: CrewDetail; today: string }) {
  const util = utilisationText(crew.utilisation);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <Button variant="link" href="/crew">
          Back to crew
        </Button>
        {crew.access.canApprove ? (
          <div className="jobs-add-head hidden lg:block">
            <Button variant="primary" href={payoutHref(crew.id)}>
              Record payout
            </Button>
          </div>
        ) : null}
      </div>
      <h1 data-crew-title="" className="text-title text-ink [overflow-wrap:anywhere]">
        <KeepTogether text={crew.name} />
      </h1>
      <p data-crew-who="" className="text-meta text-ink-2 [overflow-wrap:anywhere]">
        {headerLine(crew, today)}
      </p>
      <p className="text-meta text-ink-2">
        {payBasisLabel(crew.defaultBasis, crew.defaultUnit)}. Active from {formatDate(crew.activeFrom, today)}
      </p>
      {util ? <p className="text-meta text-ink-2">{util}</p> : null}
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
function Balance({ crew }: { crew: CrewDetail }) {
  const b = balanceView(crew.balanceCents);
  return (
    <div data-crew-balance={b.kind} className="flex flex-col gap-1">
      <p className="text-meta text-ink">{b.word}</p>
      <KeyFigure>{b.amount}</KeyFigure>
      <p className="text-body text-ink">{balanceSentence(crew.name, crew.balanceCents, crew.unpaidTooLong)}</p>
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
          <List rows={rows} reserveChevron />
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
        <div className={cx(GROUP, "divide-y")}>
          {crew.statements.map((s) => (
            <StatementRow key={s.payRunId} statement={s} crewMemberId={crew.id} today={today} demoOffline={demoOffline} />
          ))}
        </div>
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
        <List rows={rows} reserveChevron />
      )}
    </Section>
  );
}

function RecentLogs({ crew, today }: { crew: CrewDetail; today: string }) {
  const rows: ListRow[] = crew.recentLogs.slice(0, SHOWN).map((l) => ({
    key: l.id,
    primary: `${l.projectName}, ${l.stageName}`,
    meta: `${formatDate(l.date, today)}, ${logQuantityText(l)}${l.amountCents === 0 ? ", time only" : ""}`,
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
    <div data-screen="crew-detail" className={COLUMN}>
      <Header crew={crew} today={today} />
      <Balance crew={crew} />
      <Ledger crew={crew} today={today} />
      <Statements crew={crew} today={today} demoOffline={demoOffline} />
      <Rates crew={crew} today={today} />
      <RecentLogs crew={crew} today={today} />
      {crew.access.canApprove ? <JobsAddBar label="Record payout" href={payoutHref(crew.id)} /> : null}
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

/** The page while it loads (`?demo=loading`): the same blocks, as grey shapes. */
export function CrewDetailSkeleton() {
  return (
    <div data-screen="crew-detail" aria-busy="true" className={COLUMN}>
      <div className="flex flex-col gap-2">
        <Button variant="link" href="/crew" className="self-start">
          Back to crew
        </Button>
        <div className="flex h-9 items-center">
          <Skeleton width={200} height={28} />
        </div>
        <Skeleton width={220} height={14} />
        <Skeleton width={180} height={52} />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton width={96} height={14} />
        <KeyFigureSkeleton width={160} />
        <Skeleton width={260} height={20} />
      </div>
      {[3, 2].map((n, s) => (
        <section key={s} className="flex flex-col gap-2">
          <Skeleton width={120} height={24} />
          <div className={cx(GROUP, "overflow-hidden")}>
            {Array.from({ length: n }, (_, i) => (
              <div key={i} className="flex min-h-16 items-center justify-between gap-4 px-4 py-2">
                <Skeleton width={150} height={20} />
                <Skeleton width={96} height={20} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
