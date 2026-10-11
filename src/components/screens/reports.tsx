import Link from "next/link";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import type { CrewReportRow, DateRange, JobProfitRow, ReportKind } from "@/data/contracts";
import { cx } from "@/lib/cx";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadError } from "./field-entry";
import { COLUMN, FOCUS, GROUP } from "./home-parts";
import { countText, crewWorkText, marginText, rangeText, reportTitle } from "./reports-text";
import { TD, TH } from "./table-cells";

/** Full width from 1024 px: the cards sit in two columns, the report table uses the width (lesson 19). */
const WIDE = cx(COLUMN, "lg:max-w-none");
const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_min(9rem,42%)] items-start gap-x-4";
const PHONE_ROW = cx("relative block min-h-16 py-2 pl-4 pr-9 active:bg-galv", FOCUS);
const FIG = "num text-figure text-ink whitespace-nowrap";

/** One card on the Reports index: its key figure and one plain line about it. */
export type ReportCard = { kind: ReportKind; figure: string; money: boolean; line: string };

function Title({ title }: { title: string }) {
  return (
    <div className="flex min-h-12 items-center">
      <h1 className="text-title text-ink">{title}</h1>
    </div>
  );
}

function Updated({ text }: { text: string | null }) {
  return text ? <p className="text-meta text-ink-2">{text}</p> : null;
}

/** Reports index (flows.md screen 22): five cards, two columns from 1024 px. */
export function ReportsIndex({ cards, range, today, updated }: { cards: ReportCard[]; range: DateRange; today: string; updated: string | null }) {
  const empty = cards.every((c) => c.figure === "");
  return (
    <div data-screen="reports" className={WIDE}>
      <div className="flex flex-col gap-1">
        <Title title="Reports" />
        <p className="text-body text-ink">
          Last 3 months: <span data-report-range="">{rangeText(range, today)}</span>
        </p>
        <Updated text={updated} />
      </div>
      {empty ? (
        <p className="text-body text-ink">Nothing to report yet. Reports fill in once the crew logs work.</p>
      ) : null}
      <ul className="grid gap-4 lg:grid-cols-2">
        {cards.map((c) => (
          <li key={c.kind} data-report-card="">
            <Link href={`/reports/${c.kind}`} prefetch={false} className={cx("relative flex min-h-24 flex-col gap-1 rounded-group border-group bg-surface p-4 pr-10 active:bg-galv", FOCUS)}>
              <span className="text-heading text-ink">{reportTitle(c.kind)}</span>
              {c.figure ? (
                <span data-figure="" className={cx(c.money ? "num text-figure" : "text-body-strong", "text-ink")}>{c.figure}</span>
              ) : null}
              <span className="text-meta text-ink">{c.line}</span>
              <CaretRight size={24} aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-2" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReportsIndexSkeleton() {
  return (
    <div data-screen="reports" aria-busy="true" className={WIDE}>
      <Title title="Reports" />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex min-h-24 flex-col gap-2 rounded-group border-group bg-surface p-4">
            <Skeleton width={160} height={22} />
            <Skeleton width={120} height={24} />
            <Skeleton width={200} height={14} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportsIndexError() {
  return (
    <div data-screen="reports" className={WIDE}>
      <Title title="Reports" />
      <LoadError primary />
    </div>
  );
}

/** The report page frame: Back to reports, title, the range and its filter (a plain GET form, so it works without script). */
function ReportFrame({ kind, range, chosen, today, updated, children }: { kind: ReportKind; range: DateRange; chosen: boolean; today: string; updated: string | null; children: React.ReactNode }) {
  return (
    <div data-screen="report" data-report-screen={kind} className={WIDE}>
      <div className="flex flex-col gap-1">
        <Link href="/reports" prefetch={false} className={cx("flex min-h-12 items-center gap-1 self-start text-body-strong text-chalk-link", FOCUS)}>
          <CaretLeft size={24} aria-hidden="true" />
          Back to reports
        </Link>
        <Title title={reportTitle(kind)} />
        <p data-report-range="" className="text-body text-ink">{rangeText(range, today)}</p>
        <Updated text={updated} />
      </div>
      <form method="get" action={`/reports/${kind}`} className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <Field label="From" name="from" type="date" inputMode="none" defaultValue={range.from} max={today} className="sm:max-w-60" />
        <Field label="To" name="to" type="date" inputMode="none" defaultValue={range.to} max={today} className="sm:max-w-60" />
        <Button variant="secondary" type="submit" className="w-full sm:w-auto sm:min-w-40">Show range</Button>
        {chosen ? (
          <Link href={`/reports/${kind}`} prefetch={false} className={cx("flex min-h-12 items-center text-body-strong text-chalk-link", FOCUS)}>
            Show the last 3 months
          </Link>
        ) : null}
      </form>
      {children}
    </div>
  );
}

function NothingInRange() {
  return <p className="text-body text-ink">Nothing in this range. Try a longer range.</p>;
}

function JobRows({ rows }: { rows: JobProfitRow[] }) {
  return (
    <div className={cx(GROUP, "overflow-hidden")}>
      <div className="divide-y divide-line lg:hidden">
        {rows.map((r) => (
          <Link key={r.projectId} href={r.href} prefetch={false} data-report-row="" className={PHONE_ROW}>
            <span className={ROW_GRID}>
              <span className="flex flex-col">
                <span className="text-body-strong text-ink">{r.name}</span>
                <span className="text-meta text-ink">Labour <span className={FIG}>{formatMoney(r.labourCents)}</span></span>
                <span className="text-meta text-ink">Expenses <span className={FIG}>{formatMoney(r.expensesCents)}</span></span>
              </span>
              <span className="flex flex-col items-end">
                <span data-margin="" className={cx(FIG, r.forecastMarginCents < 0 && "text-over")}>{formatMoney(r.forecastMarginCents)}</span>
                <span className="text-meta text-ink text-right">margin {marginText(r.marginBp)}</span>
              </span>
            </span>
            <CaretRight size={24} aria-hidden="true" className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-2" />
          </Link>
        ))}
      </div>
      <table className="hidden w-full lg:table">
        <thead>
          <tr>
            <th scope="col" className={TH}>Job</th>
            {["Contract", "Labour", "Expenses", "Margin to date", "Forecast margin", "Margin"].map((h) => (
              <th key={h} scope="col" className={cx(TH, "text-right")}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.projectId} data-report-row="" className="relative h-14 hover:bg-galv">
              <td className={TD}>
                <Link href={r.href} prefetch={false} className={cx("block text-body-strong text-ink after:absolute after:inset-0", FOCUS)}>{r.name}</Link>
              </td>
              {[r.contractCents, r.labourCents, r.expensesCents, r.marginToDateCents].map((c, i) => (
                <td key={i} className={cx(TD, "text-right")}><span className={FIG}>{formatMoney(c)}</span></td>
              ))}
              <td className={cx(TD, "text-right")}>
                <span data-margin="" className={cx(FIG, r.forecastMarginCents < 0 && "text-over")}>{formatMoney(r.forecastMarginCents)}</span>
              </td>
              <td className={cx(TD, "text-right text-body text-ink whitespace-nowrap")}>{marginText(r.marginBp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CrewRows({ rows }: { rows: CrewReportRow[] }) {
  return (
    <div className={cx(GROUP, "overflow-hidden")}>
      <div className="divide-y divide-line lg:hidden">
        {rows.map((r) => (
          <Link key={r.crewMemberId} href={`/crew/${r.crewMemberId}`} prefetch={false} data-report-row="" className={PHONE_ROW}>
            <span className={ROW_GRID}>
              <span className="flex flex-col">
                <span className="text-body-strong text-ink">{r.name}</span>
                <span className="text-meta text-ink">{crewWorkText(r.days, r.hours)}</span>
                <span className="text-meta text-ink">{countText(r.jobs, "job")}</span>
              </span>
              <span data-earned="" className={cx(FIG, "text-right")}>{formatMoney(r.earningsCents)}</span>
            </span>
            <CaretRight size={24} aria-hidden="true" className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-2" />
          </Link>
        ))}
      </div>
      <table className="hidden w-full lg:table">
        <thead>
          <tr>
            <th scope="col" className={TH}>Name</th>
            <th scope="col" className={TH}>Worked</th>
            <th scope="col" className={cx(TH, "text-right")}>Jobs</th>
            <th scope="col" className={cx(TH, "text-right")}>Utilisation</th>
            <th scope="col" className={cx(TH, "text-right")}>Earned</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.crewMemberId} data-report-row="" className="relative h-14 hover:bg-galv">
              <td className={TD}>
                <Link href={`/crew/${r.crewMemberId}`} prefetch={false} className={cx("block text-body-strong text-ink after:absolute after:inset-0", FOCUS)}>{r.name}</Link>
              </td>
              <td className={cx(TD, "text-body text-ink")}>{crewWorkText(r.days, r.hours)}</td>
              <td className={cx(TD, "text-right text-body text-ink")}>{r.jobs}</td>
              <td className={cx(TD, "text-right text-body text-ink")}>{r.utilisationBp === null ? "None" : marginText(r.utilisationBp)}</td>
              <td className={cx(TD, "text-right")}><span data-earned="" className={FIG}>{formatMoney(r.earningsCents)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type ReportBody =
  | { kind: "job-profitability"; rows: JobProfitRow[] }
  | { kind: "crew"; rows: CrewReportRow[] }
  | { kind: "productivity" | "pauses" | "pay-history"; rows: unknown[] };

export type ReportFrameProps = { range: DateRange; chosen: boolean; today: string; updated: string | null };

/** One report (flows.md screen 22, `/reports/[kind]`): every row drills down to its source (job detail, crew detail). */
export function ReportView({ body, ...frame }: ReportFrameProps & { body: ReportBody }) {
  let content: React.ReactNode;
  if (body.kind !== "job-profitability" && body.kind !== "crew") content = <p className="text-body text-ink">This report shows here soon.</p>;
  else if (body.rows.length === 0) content = <NothingInRange />;
  else content = body.kind === "job-profitability" ? <JobRows rows={body.rows} /> : <CrewRows rows={body.rows} />;
  return <ReportFrame kind={body.kind} {...frame}>{content}</ReportFrame>;
}

export function ReportSkeleton({ kind, ...frame }: ReportFrameProps & { kind: ReportKind }) {
  return (
    <ReportFrame kind={kind} {...frame}>
      <div aria-busy="true" className={cx(GROUP, "overflow-hidden")}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="min-h-16 px-4 py-2">
            <div className={ROW_GRID}>
              <div className="flex flex-col gap-1"><Skeleton width={180} height={20} /><Skeleton width={120} height={14} /><Skeleton width={120} height={14} /></div>
              <div className="flex justify-end"><Skeleton width={96} height={22} /></div>
            </div>
          </div>
        ))}
      </div>
    </ReportFrame>
  );
}

export function ReportError({ kind, ...frame }: ReportFrameProps & { kind: ReportKind }) {
  return (
    <ReportFrame kind={kind} {...frame}>
      <LoadError primary />
    </ReportFrame>
  );
}
