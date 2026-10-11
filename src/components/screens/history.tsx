import Link from "next/link";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import type { AuditRow } from "@/data/contracts";
import { EmptyState } from "@/components/empty-state";
import { KeepTogether } from "@/components/keep-together";
import { Skeleton } from "@/components/ui/skeleton";
import { cx } from "@/lib/cx";
import { formatDateTime } from "@/lib/format";
import { LoadError } from "./field-entry";
import { COLUMN, FOCUS, GROUP } from "./home-parts";
import { historyFilterText, historyHref, historyIsFiltered, historySentence, type HistoryFilter } from "./history-text";
import { TD, TH } from "./table-cells";

/** Full width from 1024 px: the changes sit in a table that uses the width (lesson 21). */
const WIDE = cx(COLUMN, "lg:max-w-none");

type Frame = { filter: HistoryFilter; today: string; updated: string | null; demo?: string };
type Names = { job: string | null; crew: string | null; row: string | null };

/** Where Back goes: the job, the person or the expense being looked at, else More. */
function backTarget(filter: HistoryFilter): { href: string; label: string } {
  if (filter.projectId) return { href: `/jobs/${filter.projectId}`, label: "Back to the job" };
  if (filter.crewMemberId) return { href: `/crew/${filter.crewMemberId}`, label: "Back to the crew member" };
  if (filter.table === "expense" && filter.rowId) return { href: `/expenses/${filter.rowId}`, label: "Back to the expense" };
  return { href: "/more", label: "Back to More" };
}

function Head({ filter, names, updated, demo }: Frame & { names?: Names }) {
  const back = backTarget(filter);
  const showing = names ? historyFilterText(names) : null;
  return (
    <div className="flex flex-col gap-1">
      <Link href={back.href} prefetch={false} className={cx("flex min-h-12 items-center gap-1 self-start text-body-strong text-chalk-link", FOCUS)}>
        <CaretLeft size={24} aria-hidden="true" />
        {back.label}
      </Link>
      <div className="flex min-h-12 items-center">
        <h1 className="text-title text-ink">Record history</h1>
      </div>
      {updated ? <p className="text-meta text-ink-2">{updated}</p> : null}
      {historyIsFiltered(filter) ? (
        <div data-history-showing="" className="flex flex-wrap items-center gap-x-4">
          <p className="min-w-0 text-body-strong text-ink [overflow-wrap:anywhere]">
            <KeepTogether text={showing ?? "Showing this one"} />
          </p>
          <Link href={historyHref({ projectId: null, crewMemberId: null, table: null, rowId: null }, demo)} prefetch={false} className={cx("flex min-h-12 min-w-12 items-center justify-center text-body-strong text-chalk-link", FOCUS)}>
            Clear
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function When({ row, timeZone, today }: { row: AuditRow; timeZone: string; today: string }) {
  return <>{formatDateTime(row.at, timeZone, today)}</>;
}

/** One change on a phone: the sentence, then who, when and the job as three short lines (never joined with dots). */
function PhoneRow({ row, timeZone, today, showJob }: { row: AuditRow; timeZone: string; today: string; showJob: boolean }) {
  return (
    <li data-history-row="" className="flex min-h-16 flex-col gap-0.5 px-4 py-3">
      <p data-history-what="" className="text-body text-ink [overflow-wrap:anywhere]">
        <KeepTogether text={historySentence(row, today)} />
      </p>
      <p className="text-meta text-ink-2">{row.actorName}</p>
      <p className="text-meta text-ink-2">
        <When row={row} timeZone={timeZone} today={today} />
      </p>
      {showJob && row.projectName ? (
        <p data-history-job="" className="text-meta text-ink-2 [overflow-wrap:anywhere]">
          <KeepTogether text={row.projectName} />
        </p>
      ) : null}
    </li>
  );
}

function Table({ rows, timeZone, today, showJob }: { rows: AuditRow[]; timeZone: string; today: string; showJob: boolean }) {
  return (
    <table className="hidden w-full table-fixed border-collapse lg:table">
      <thead>
        <tr className="border-b border-line">
          <th scope="col" className={cx(TH, "w-56")}>When</th>
          <th scope="col" className={cx(TH, "w-44")}>Who</th>
          <th scope="col" className={TH}>What changed</th>
          {showJob ? <th scope="col" className={cx(TH, "w-64")}>Job</th> : null}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((row) => (
          <tr key={row.id} data-history-row="" className="align-top">
            <td className={cx(TD, "py-3 text-body text-ink")}><When row={row} timeZone={timeZone} today={today} /></td>
            <td className={cx(TD, "py-3 text-body text-ink [overflow-wrap:anywhere]")}>{row.actorName}</td>
            <td data-history-what="" className={cx(TD, "py-3 text-body text-ink [overflow-wrap:anywhere]")}><KeepTogether text={historySentence(row, today)} /></td>
            {showJob ? <td data-history-job="" className={cx(TD, "py-3 text-body text-ink [overflow-wrap:anywhere]")}>{row.projectName ? <KeepTogether text={row.projectName} /> : null}</td> : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function HistoryList({ rows, timeZone, names, ...frame }: Frame & { rows: AuditRow[]; timeZone: string; names: Names }) {
  const showJob = !frame.filter.projectId;
  const subject = names.job ?? names.crew ?? names.row;
  return (
    <div data-screen="history" className={WIDE}>
      <Head {...frame} names={names} />
      {rows.length === 0 ? (
        <EmptyState
          message={historyIsFiltered(frame.filter) ? `No changes${subject ? ` for ${subject}` : ""} yet.` : "No changes yet. Changes to jobs, pay and expenses show here."}
          actionLabel={historyIsFiltered(frame.filter) ? "Show all changes" : undefined}
          href={historyHref({ projectId: null, crewMemberId: null, table: null, rowId: null }, frame.demo)}
        />
      ) : (
        <div className={cx(GROUP, "overflow-hidden")}>
          <ul className="divide-y divide-line lg:hidden">
            {rows.map((row) => (
              <PhoneRow key={row.id} row={row} timeZone={timeZone} today={frame.today} showJob={showJob} />
            ))}
          </ul>
          <Table rows={rows} timeZone={timeZone} today={frame.today} showJob={showJob} />
        </div>
      )}
    </div>
  );
}

export function HistorySkeleton(frame: Frame) {
  return (
    <div data-screen="history" className={WIDE}>
      <Head {...frame} />
      <div aria-busy="true" className={cx(GROUP, "overflow-hidden")}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex min-h-16 flex-col gap-1 px-4 py-3">
            <Skeleton width={260} height={20} />
            <Skeleton width={90} height={14} />
            <Skeleton width={140} height={14} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HistoryError(frame: Frame) {
  return (
    <div data-screen="history" className={WIDE}>
      <Head {...frame} />
      <LoadError primary />
    </div>
  );
}
