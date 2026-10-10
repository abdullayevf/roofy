import Link from "next/link";
import { CaretRight, WarningDiamond } from "@phosphor-icons/react/dist/ssr";
import type { CrewList, CrewRowForeman, CrewRowManager } from "@/data/contracts";
import { cx } from "@/lib/cx";
import { EmptyState } from "@/components/empty-state";
import { KeepTogether } from "@/components/keep-together";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { formatMoney } from "@/lib/format";
import { balanceView, crewLine, lastLoggedDate, lastLoggedText, owedCountText } from "./crew-input";
import { CrewFilter, type CrewFilterValue } from "./crew-filter";
import { CrewOfflineNote } from "./crew-offline-note";
import { LoadError } from "./field-entry";
import { COLUMN, FOCUS, GROUP, KeyFigure, KeyFigureSkeleton } from "./home-parts";
import { TD, TH } from "./table-cells";

/** The Crew page column: left-aligned from 1024 px, where the manager's list is a table the width of the content. */
const CREW_COLUMN = cx(COLUMN, "lg:max-w-none");
/** The fixed right column of a phone row: the balance, right-aligned, never squeezed by a long name. */
const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_min(8.5rem,40%)] items-start gap-x-4";

function Header() {
  return (
    <div className="crew-head-title flex min-h-12 items-center">
      <h1 className="text-title text-ink">Crew</h1>
    </div>
  );
}

/** The balance as a figure with its plain word under it, right-aligned. Manager rows only: a foreman's row never gets one. */
function Balance({ row }: { row: CrewRowManager }) {
  const b = balanceView(row.balanceCents);
  // Nothing owed is a plain word, not a bold $0.00 competing with the people who are owed.
  if (b.kind === "clear")
    return (
      <span data-crew-balance={b.kind} className="flex flex-col items-end text-right">
        <span className="text-meta text-ink">{b.word}</span>
      </span>
    );
  return (
    <span data-crew-balance={b.kind} className="flex flex-col items-end text-right">
      <span className="text-figure num text-ink whitespace-nowrap">{b.amount}</span>
      <span className="text-meta text-ink">{b.word}</span>
    </span>
  );
}

function TooLong() {
  return (
    <span data-crew-too-long="" className="flex items-start gap-1.5 text-meta text-watch">
      <WarningDiamond size={20} aria-hidden="true" className="shrink-0" />
      Owed for a long time
    </span>
  );
}

function Name({ row }: { row: CrewRowForeman }) {
  return (
    <span data-crew-name="" className="block text-body-strong text-ink [overflow-wrap:anywhere]">
      <KeepTogether text={row.name} />
    </span>
  );
}

/** A manager's phone or tablet row: name, who they are, when they last worked, and the balance in the right column. */
function ManagerPhoneRow({ row, today }: { row: CrewRowManager; today: string }) {
  return (
    <Link
      href={`/crew/${row.id}`}
      prefetch={false}
      data-crew-row=""
      className={cx("relative block min-h-16 py-2 pl-4 pr-9 first:rounded-t-group last:rounded-b-group active:bg-galv", FOCUS)}
    >
      <span className={ROW_GRID}>
        <span className="flex flex-col">
          <Name row={row} />
          <span data-crew-line="" className="text-meta text-ink [overflow-wrap:anywhere]">{crewLine(row)}</span>
          {row.active ? null : <StatusChip status="inactive" plain />}
          <span className="text-meta text-ink">{lastLoggedText(row.lastLogDate, today)}</span>
          {row.unpaidTooLong ? <TooLong /> : null}
        </span>
        <Balance row={row} />
      </span>
      <CaretRight size={24} aria-hidden="true" className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-2" />
    </Link>
  );
}

/** A foreman's row: name, type and how they are paid. Not a link, since a crew member's page is the manager's. */
function ForemanRow({ row }: { row: CrewRowForeman }) {
  return (
    <div data-crew-row="" className="min-h-16 px-4 py-2">
      <Name row={row} />
      <span data-crew-line="" className="block text-meta text-ink [overflow-wrap:anywhere]">{crewLine(row)}</span>
      {row.active ? null : <StatusChip status="inactive" plain />}
    </div>
  );
}

/** From 1024 px, a manager's list is a table with the whole row as the link: person, last logged, balance. */
function ManagerTable({ rows, today }: { rows: CrewRowManager[]; today: string }) {
  return (
    <table className="hidden w-full lg:table">
      <thead>
        <tr>
          <th scope="col" className={TH}>Person</th>
          <th scope="col" className={TH}>Last logged</th>
          <th scope="col" className={cx(TH, "text-right")}>Balance</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((row) => (
          <tr key={row.id} data-crew-row="" className="relative h-14 hover:bg-galv">
            <td className={TD}>
              <Link href={`/crew/${row.id}`} prefetch={false} className={cx("block text-body-strong text-ink after:absolute after:inset-0", FOCUS)}>
                <KeepTogether text={row.name} />
              </Link>
              <span data-crew-line="" className="block text-meta text-ink">{crewLine(row)}</span>
              {row.active ? null : <StatusChip status="inactive" plain />}
            </td>
            <td className={cx(TD, "text-body text-ink")}>{lastLoggedDate(row.lastLogDate, today)}</td>
            <td className={cx(TD, "pr-4 text-right")}>
              <Balance row={row} />
              {row.unpaidTooLong ? (
                <span className="flex justify-end">
                  <TooLong />
                </span>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export type CrewListProps = {
  list: CrewList;
  filter: CrewFilterValue;
  /** The workspace has crew, just none under this filter. */
  anyCrew: boolean;
  /** The workspace's local date, for "Last logged Fri 25 Sep". */
  today: string;
  demo?: string;
};

/** Crew list (flows.md screen 14): who is on the crew, and what each is owed (manager). Props only; the page fetches. */
export function CrewListBody({ list, filter, anyCrew, today, demo }: CrewListProps) {
  const manager = list.view === "manager";
  if (list.rows.length === 0 && !anyCrew) {
    return (
      <div data-screen="crew" className={CREW_COLUMN}>
        <Header />
        <div className="flex min-h-[50dvh] flex-col justify-center">
          {manager ? (
            <EmptyState message="No crew yet. Add your crew in Settings." actionLabel="Open Settings" href="/settings" />
          ) : (
            <EmptyState message="No crew yet. Ask your manager to add them." />
          )}
        </div>
      </div>
    );
  }
  return (
    <div data-screen="crew" className={CREW_COLUMN}>
      <div className="crew-head flex flex-col gap-8 lg:gap-10">
        <div className="crew-head-top flex flex-col gap-2">
          <Header />
          {list.view === "manager" ? (
            <div data-crew-owed="" className="flex flex-col gap-1">
              <KeyFigure>{formatMoney(list.owedTotalCents)}</KeyFigure>
              <p className="text-meta text-ink">{owedCountText(list.rows)}</p>
              {/* On a phone on its side the sentence above is dropped; this keeps "owed" with the figure. */}
              <span data-crew-owed-word="" className="hidden text-body text-ink">owed</span>
            </div>
          ) : null}
        </div>
        {manager ? <CrewFilter value={filter} demo={demo} /> : null}
      </div>
      <CrewOfflineNote asOf={list.asOf} timeZone={list.timeZone} manager={manager} demoOffline={demo === "offline"} />
      {list.rows.length === 0 ? (
        <p className="text-body text-ink">No one is active right now. Show inactive crew to see who has left.</p>
      ) : list.view === "manager" ? (
        <div className={cx(GROUP, "overflow-hidden")}>
          <div className="divide-y divide-line lg:hidden">
            {list.rows.map((row) => (
              <ManagerPhoneRow key={row.id} row={row} today={today} />
            ))}
          </div>
          <ManagerTable rows={list.rows} today={today} />
        </div>
      ) : (
        <div className={cx(GROUP, "overflow-hidden")}>
          {list.rows.map((row) => (
            <ForemanRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

/** The list when the server can't answer: the title stays, the list area says so, and Try again is the one primary button. */
export function CrewError({ manager, filter, demo }: { manager: boolean; filter: CrewFilterValue; demo?: string }) {
  return (
    <div data-screen="crew" className={CREW_COLUMN}>
      <Header />
      {manager ? <CrewFilter value={filter} demo={demo} /> : null}
      <LoadError primary />
    </div>
  );
}

/** One manager row's shape while it loads: name, line, last logged, and the balance in the right column. */
function RowSkeleton({ manager }: { manager: boolean }) {
  return (
    <div className="min-h-16 px-4 py-2">
      <div className={manager ? ROW_GRID : undefined}>
        <div className="flex flex-col">
          <div className="flex h-6 items-center">
            <Skeleton width={160} height={20} />
          </div>
          <div className="flex h-5 items-center">
            <Skeleton width={170} height={14} />
          </div>
          <div className="flex h-5 items-center">
            <Skeleton width={110} height={14} />
          </div>
          {manager ? (
            <div className="flex h-5 items-center">
              <Skeleton width={140} height={14} />
            </div>
          ) : null}
        </div>
        {manager ? (
          <div className="flex flex-col items-end">
            <div className="flex h-6 items-center">
              <Skeleton width={96} height={22} />
            </div>
            <div className="flex h-5 items-center">
              <Skeleton width={64} height={14} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** The list while it loads (`?demo=loading`): real title, a line for the headline, chips and rows as blocks. */
export function CrewSkeleton({ manager }: { manager: boolean }) {
  return (
    <div data-screen="crew" aria-busy="true" className={CREW_COLUMN}>
      <div className="crew-head flex flex-col gap-8 lg:gap-10">
        <div className="crew-head-top flex flex-col gap-2">
          <Header />
          {manager ? (
            <div data-crew-owed="" className="flex flex-col gap-1">
              <KeyFigureSkeleton width={240} />
              <div className="flex h-6 items-center">
                <Skeleton width={150} height={14} />
              </div>
            </div>
          ) : null}
        </div>
        {manager ? (
          <div className="flex flex-wrap gap-2">
            {[84, 168].map((w, i) => (
              <Skeleton key={i} width={w} height={48} rounded="full" />
            ))}
          </div>
        ) : null}
      </div>
      <div className={cx(GROUP, "overflow-hidden")}>
        {Array.from({ length: 6 }, (_, i) => (
          <RowSkeleton key={i} manager={manager} />
        ))}
      </div>
    </div>
  );
}
