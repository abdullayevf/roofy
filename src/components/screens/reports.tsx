import Link from "next/link";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import type { CrewReportRow, DateRange, JobProfitRow, PauseReportRow, PayHistoryRow, ProductivityRow, ReportKeyFigure, ReportKind } from "@/data/contracts";
import { KeepTogether } from "@/components/keep-together";
import { StatusChip } from "@/components/ui/status-chip";
import { cx } from "@/lib/cx";
import { formatMoney, formatQuantity } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadError } from "./field-entry";
import { COLUMN, FOCUS, GROUP } from "./home-parts";
import { jobTypeLabel } from "./job-input";
import { payRunPeriodText } from "./pay-runs-text";
import { ReportPrintButton } from "./report-print-button";
import { countText, crewWorkText, keyFigureParts, marginText, monthText, pauseReasonLine, periodText, rangeText, reportCsvHref, reportTitle } from "./reports-text";
import { TD, TH } from "./table-cells";

/** Full width from 1024 px: the hub list and the report table use the width (lesson 21). */
const WIDE = cx(COLUMN, "lg:max-w-none");
/** Left text, right figure column that is as wide as its figure and never wraps (D5, lesson 23). */
const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4";
const PHONE_ROW = cx("relative block min-h-16 py-2 pl-4 pr-10 active:bg-galv", FOCUS);
const FIG = "num text-figure text-ink whitespace-nowrap";
/** One rule for a negative figure in every column and on every row: the over-budget colour (D10). */
const fig = (cents: number): string => cx(FIG, cents < 0 && "text-over");
const NO_WRAP = "whitespace-nowrap";

/** One row of the Reports index: its key figure (split from its unit, which sits on a meta line) and one plain line about it. */
export type ReportCard = { kind: ReportKind; figure: string; unit: string; line: string };

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

/** The right figure column: the figure on one line (data-oneline), its unit on a meta line below (D5). */
function FigureColumn({ figure, unit, negative, attrs }: { figure: string; unit?: string; negative?: boolean; attrs?: Record<string, string> }) {
  return (
    <span className="flex flex-col items-end">
      <span {...attrs} data-oneline="" className={cx(FIG, negative && "text-over")}>{figure}</span>
      {unit ? (
        <>
          {" "}
          <span data-oneline="" className={cx("text-meta text-ink", NO_WRAP)}>{unit}</span>
        </>
      ) : null}
    </span>
  );
}

const Caret = () => <CaretRight size={24} aria-hidden="true" className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-2" />;

/** Reports index (flows.md screen 22): one grouped list, a row per report (lesson 36). */
export function ReportsIndex({ cards, range, today, updated, action }: { cards: ReportCard[]; range: DateRange; today: string; updated: string | null; action: { href: string; label: string } }) {
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
        <div data-report-empty="" className="flex flex-col items-start gap-4">
          <p className="text-body text-ink">Nothing to report yet. Reports fill in once the crew logs work.</p>
          <Button variant="secondary" href={action.href} className="w-full sm:w-auto sm:min-w-40">{action.label}</Button>
        </div>
      ) : (
        <ul data-report-list="" className={cx(GROUP, "overflow-hidden")}>
          {cards.map((c) => (
            <li key={c.kind} data-report-card="">
              <Link href={`/reports/${c.kind}`} prefetch={false} className={cx("relative block min-h-16 py-2 pl-4 pr-10 active:bg-galv lg:min-h-12", FOCUS)}>
                <span className={ROW_GRID}>
                  <span className="flex flex-col">
                    <span className="text-body-strong text-ink">{reportTitle(c.kind)}</span>
                    <span className="text-meta text-ink">{c.line}</span>
                  </span>
                  {c.figure ? <FigureColumn figure={c.figure} unit={c.unit} attrs={{ "data-figure": "" }} /> : <span />}
                </span>
                <Caret />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ReportsIndexSkeleton() {
  return (
    <div data-screen="reports" aria-busy="true" className={WIDE}>
      <Title title="Reports" />
      <div className={cx(GROUP, "overflow-hidden")}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="min-h-16 px-4 py-2 lg:min-h-12">
            <div className={ROW_GRID}>
              <div className="flex flex-col gap-1"><Skeleton width={160} height={22} /><Skeleton width={200} height={14} /></div>
              <div className="flex flex-col items-end gap-1"><Skeleton width={96} height={22} /><Skeleton width={72} height={14} /></div>
            </div>
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

/** The key figure: the one figure-xl on a report page, with its unit beside it and its label under it (N3/D8, lesson 5). */
function KeyFigure({ figure }: { figure: ReportKeyFigure }) {
  const { figure: text, unit } = keyFigureParts(figure);
  return (
    <div data-key-figure="" className="flex flex-col lg:col-span-2 lg:row-start-3">
      <p data-oneline="" className="text-figure-xl num text-ink whitespace-nowrap">
        {text}
        {unit ? (
          <>
            {" "}
            <span className="text-body text-ink">{unit}</span>
          </>
        ) : null}
      </p>
      <p className="text-meta text-ink">{figure.label}.</p>
    </div>
  );
}

type FrameProps = { kind: ReportKind; range: DateRange; chosen: boolean; today: string; updated: string | null; empty: boolean; open: boolean; figure: React.ReactNode; children: React.ReactNode };

/**
 * The report page frame: Back to reports, the title with Export CSV and Print in its row on desktop, the key figure, then
 * the range as one "Change" row (a plain GET form in a native details, so it works without script). Nothing to export means
 * both buttons are off (D14).
 */
function ReportFrame({ kind, range, chosen, today, updated, empty, open, figure, children }: FrameProps) {
  const offline = updated !== null;
  const BTN = "flex-1 sm:flex-none sm:min-w-40";
  return (
    <div data-screen="report" data-report-screen={kind} className={WIDE}>
      <div className="flex flex-col gap-1 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-6">
        <Link href="/reports" prefetch={false} className={cx("flex min-h-12 items-center gap-1 self-start text-body-strong text-chalk-link print:hidden lg:col-span-2 lg:row-start-1", FOCUS)}>
          <CaretLeft size={24} aria-hidden="true" />
          Back to reports
        </Link>
        <div className="lg:col-start-1 lg:row-start-2">
          <Title title={reportTitle(kind)} />
        </div>
        {figure}
        <details open={open} className="lg:col-span-2 lg:row-start-4">
          <summary className={cx("flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 marker:hidden", FOCUS)}>
            <span data-report-range="" className="text-body text-ink">{rangeText(range, today)}</span>
            <span className="text-body-strong text-chalk-link print:hidden">Change</span>
          </summary>
          <form method="get" action={`/reports/${kind}`} className="flex flex-col gap-4 pb-2 pt-2 sm:flex-row sm:flex-wrap sm:items-end print:hidden">
            <Field label="From" name="from" type="date" inputMode="none" defaultValue={range.from} max={today} className="sm:max-w-60" />
            <Field label="To" name="to" type="date" inputMode="none" defaultValue={range.to} max={today} className="sm:max-w-60" />
            <Button variant="secondary" type="submit" className="w-full sm:w-auto sm:min-w-40">Show range</Button>
            {chosen && !empty ? (
              <Link href={`/reports/${kind}`} prefetch={false} className={cx("flex min-h-12 items-center text-body-strong text-chalk-link", FOCUS)}>
                Show the last 3 months
              </Link>
            ) : null}
          </form>
        </details>
        <div className="lg:col-span-2 lg:row-start-5 empty:hidden"><Updated text={updated} /></div>
        <div data-report-actions="" className="flex flex-wrap gap-2 pt-2 print:hidden lg:col-start-2 lg:row-start-2 lg:justify-end lg:self-center lg:pt-0">
          {offline ? (
            <p className="w-full text-body text-ink sm:w-auto">Export CSV needs a connection.</p>
          ) : empty ? (
            <Button variant="secondary" disabled className={BTN}>Export CSV</Button>
          ) : (
            <Button variant="secondary" href={reportCsvHref(kind, range)} download className={BTN}>Export CSV</Button>
          )}
          <ReportPrintButton disabled={empty} className={BTN} />
        </div>
      </div>
      {children}
    </div>
  );
}

/** The shared empty sentence; on a chosen range it comes with the way back to the default (D14/N8). */
function NothingInRange({ kind, chosen }: { kind: ReportKind; chosen: boolean }) {
  return (
    <div data-report-empty="" className="flex flex-col items-start gap-4">
      <p className="text-body text-ink">Nothing in this range. Try a longer range.</p>
      {chosen ? (
        <Button variant="secondary" href={`/reports/${kind}`} className="w-full sm:w-auto sm:min-w-40">Show the last 3 months</Button>
      ) : null}
    </div>
  );
}

/** A desktop table's last header and cell leave room for the row's trailing chevron, so headers and figures still line up (D22). */
const CHEVRON_GAP = "inline-flex items-center justify-end gap-2";
const ChevronSpacer = () => <span aria-hidden="true" className="inline-block h-6 w-6" />;
const TrailingChevron = () => <CaretRight size={24} aria-hidden="true" className="text-ink-2" />;

function JobRows({ rows }: { rows: JobProfitRow[] }) {
  return (
    <div className={cx(GROUP, "overflow-hidden")}>
      <div className="divide-y divide-line lg:hidden">
        {rows.map((r) => (
          <Link key={r.projectId} href={r.href} prefetch={false} data-report-row="" className={PHONE_ROW}>
            <span className={ROW_GRID}>
              <span className="flex flex-col">
                <span className="text-body-strong text-ink"><KeepTogether text={r.name} /></span>
                {r.marginBp === null ? <span className="text-meta text-ink">No contract price</span> : null}
                <span className={cx("text-meta text-ink", NO_WRAP)}>Labour <span className={FIG}>{formatMoney(r.labourCents)}</span></span>
                <span className={cx("text-meta text-ink", NO_WRAP)}>Expenses <span className={FIG}>{formatMoney(r.expensesCents)}</span></span>
              </span>
              <span className="flex flex-col items-end">
                <span data-margin="" data-oneline="" className={fig(r.forecastMarginCents)}>{formatMoney(r.forecastMarginCents)}</span>
                {r.marginBp === null ? null : (
                  <span data-oneline="" className={cx("text-meta text-ink", NO_WRAP, r.marginBp < 0 && "text-over")}>margin {marginText(r.marginBp)}</span>
                )}
              </span>
            </span>
            <Caret />
          </Link>
        ))}
      </div>
      <table className="hidden w-full lg:table">
        <thead>
          <tr>
            <th scope="col" className={TH}>Job</th>
            {["Contract", "Labour", "Expenses", "To date", "Forecast"].map((h) => (
              <th key={h} scope="col" className={cx(TH, "text-right", NO_WRAP)}>{h}</th>
            ))}
            <th scope="col" className={cx(TH, "text-right", NO_WRAP)}>
              <span className={CHEVRON_GAP}>Margin<ChevronSpacer /></span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.projectId} data-report-row="" className="relative h-14 hover:bg-galv">
              <td className={TD}>
                <Link href={r.href} prefetch={false} className={cx("block text-body-strong text-ink after:absolute after:inset-0", FOCUS)}><KeepTogether text={r.name} /></Link>
              </td>
              {[r.contractCents, r.labourCents, r.expensesCents, r.marginToDateCents].map((c, i) => (
                <td key={i} className={cx(TD, "text-right")}><span className={fig(c)}>{formatMoney(c)}</span></td>
              ))}
              <td className={cx(TD, "text-right")}>
                <span data-margin="" className={fig(r.forecastMarginCents)}>{formatMoney(r.forecastMarginCents)}</span>
              </td>
              <td className={cx(TD, "text-right text-body text-ink", NO_WRAP, r.marginBp !== null && r.marginBp < 0 && "text-over")}>
                <span className={CHEVRON_GAP}>{marginText(r.marginBp)}<TrailingChevron /></span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PER_UNIT = { m2: "a\u00a0m²", lm: "a\u00a0lm", each: "each" } as const;
/** "Sheet install $12.40 a m²": labour cost per unit by stage (product spec §5.10). */
const costPerUnitText = (u: CrewReportRow["costPerUnit"][number]): string => `${u.stageName} ${formatMoney(u.centsPerUnit)} ${PER_UNIT[u.unit]}`;

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
                {r.costPerUnit.map((u) => (
                  <span key={`${u.stageName}|${u.unit}`} data-cost-per-unit="" data-oneline="" className={cx("text-meta text-ink", NO_WRAP)}>{costPerUnitText(u)}</span>
                ))}
              </span>
              <span data-earned="" data-oneline="" className={cx(fig(r.earningsCents), "text-right")}>{formatMoney(r.earningsCents)}</span>
            </span>
            <Caret />
          </Link>
        ))}
      </div>
      <table className="hidden w-full lg:table">
        <thead>
          <tr>
            <th scope="col" className={TH}>Name</th>
            <th scope="col" className={TH}>Worked</th>
            <th scope="col" className={cx(TH, "text-right")}>Jobs</th>
            <th scope="col" className={cx(TH, "text-right", NO_WRAP)}>Utilisation</th>
            <th scope="col" className={TH}>Cost per unit</th>
            <th scope="col" className={cx(TH, "text-right", NO_WRAP)}>
              <span className={CHEVRON_GAP}>Earned<ChevronSpacer /></span>
            </th>
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
              <td className={cx(TD, "text-meta text-ink")}>
                {r.costPerUnit.length === 0 ? "None" : r.costPerUnit.map((u) => <span key={`${u.stageName}|${u.unit}`} data-cost-per-unit="" className="block">{costPerUnitText(u)}</span>)}
              </td>
              <td className={cx(TD, "text-right")}>
                <span className={CHEVRON_GAP}><span data-earned="" className={fig(r.earningsCents)}>{formatMoney(r.earningsCents)}</span><TrailingChevron /></span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const STATIC_ROW = "block min-h-16 py-2 px-4";
const ROW_LINK = cx("block text-body-strong text-ink after:absolute after:inset-0", FOCUS);
/** Productivity: stages finished per crew-day by month. A row sums many stages, so it has no single source to open. */
function ProductivityRows({ rows, today }: { rows: ProductivityRow[]; today: string }) {
  const key = (r: ProductivityRow) => `${r.month}|${r.stageName}|${r.jobType}|${r.unit}`;
  return (
    <div className={cx(GROUP, "overflow-hidden")}>
      <div className="divide-y divide-line lg:hidden">
        {rows.map((r) => (
          <div key={key(r)} data-report-row="" className={STATIC_ROW}>
            <span className={ROW_GRID}>
              <span className="flex flex-col">
                <span className="text-body-strong text-ink"><KeepTogether text={r.stageName} /></span>
                <span className="text-meta text-ink">{periodText(r, today)}</span>
                <span className="text-meta text-ink">{jobTypeLabel(r.jobType)}</span>
                <span className="text-meta text-ink">{formatQuantity(r.quantity, r.unit)} in {countText(r.crewDays, "crew-day")}</span>
              </span>
              <FigureColumn figure={formatQuantity(r.perCrewDay, r.unit)} unit="a crew-day" attrs={{ "data-pace": "" }} />
            </span>
          </div>
        ))}
      </div>
      <table className="hidden w-full lg:table">
        <thead>
          <tr>
            {["When", "Stage", "Job type"].map((h) => <th key={h} scope="col" className={TH}>{h}</th>)}
            {["Done", "Crew-days", "Pace"].map((h) => <th key={h} scope="col" className={cx(TH, "text-right", NO_WRAP)}>{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={key(r)} data-report-row="" className="h-14">
              <td className={cx(TD, "text-body text-ink whitespace-nowrap")}>{periodText(r, today)}</td>
              <td className={cx(TD, "text-body-strong text-ink")}><KeepTogether text={r.stageName} /></td>
              <td className={cx(TD, "text-body text-ink")}>{jobTypeLabel(r.jobType)}</td>
              <td className={cx(TD, "num text-right text-body text-ink whitespace-nowrap")}>{formatQuantity(r.quantity, r.unit)}</td>
              <td className={cx(TD, "num text-right text-body text-ink")}>{r.crewDays}</td>
              <td className={cx(TD, "text-right")}><span data-pace="" className={FIG}>{formatQuantity(r.perCrewDay, r.unit)}</span> <span className={cx("text-meta text-ink", NO_WRAP)}>a crew-day</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const stageHref = (r: PauseReportRow) => `/jobs/${r.projectId}/stages/${r.stageId}`;

/** Pauses: working days lost per stage and reason; a row opens the paused stage. */
function PauseRows({ rows }: { rows: PauseReportRow[] }) {
  const key = (r: PauseReportRow, i: number) => `${r.stageId}|${r.month}|${r.reason}|${i}`;
  return (
    <div className={cx(GROUP, "overflow-hidden")}>
      <div className="divide-y divide-line lg:hidden">
        {rows.map((r, i) => (
          <Link key={key(r, i)} href={stageHref(r)} prefetch={false} data-report-row="" className={PHONE_ROW}>
            <span className={ROW_GRID}>
              <span className="flex flex-col">
                <span className="text-body-strong text-ink"><KeepTogether text={r.projectName} /></span>
                <span className="text-meta text-ink"><KeepTogether text={r.stageName} /></span>
                <span className="text-meta text-ink">{pauseReasonLine(r.reason)}</span>
                <span className="text-meta text-ink">{monthText(r.month)}</span>
              </span>
              <FigureColumn figure={String(r.workingDays)} unit={r.workingDays === 1 ? "working day" : "working days"} attrs={{ "data-days": "" }} />
            </span>
            <Caret />
          </Link>
        ))}
      </div>
      <table className="hidden w-full lg:table">
        <thead>
          <tr>
            {["Job", "Stage", "Reason", "Month"].map((h) => <th key={h} scope="col" className={TH}>{h}</th>)}
            <th scope="col" className={cx(TH, "text-right", NO_WRAP)}>
              <span className={CHEVRON_GAP}>Working days lost<ChevronSpacer /></span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={key(r, i)} data-report-row="" className="relative h-14 hover:bg-galv">
              <td className={TD}>
                <Link href={stageHref(r)} prefetch={false} className={ROW_LINK}><KeepTogether text={r.projectName} /></Link>
              </td>
              <td className={cx(TD, "text-body text-ink")}><KeepTogether text={r.stageName} /></td>
              <td className={cx(TD, "text-body text-ink")}>{pauseReasonLine(r.reason)}</td>
              <td className={cx(TD, "text-body text-ink whitespace-nowrap")}>{monthText(r.month)}</td>
              <td className={cx(TD, "num text-right text-body text-ink")}>
                <span className={CHEVRON_GAP}>{r.workingDays}<TrailingChevron /></span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Pay history: each pay run in the range with its totals; a row opens the pay run. */
function PayHistoryRows({ rows, today }: { rows: PayHistoryRow[]; today: string }) {
  return (
    <div className={cx(GROUP, "overflow-hidden")}>
      <div className="divide-y divide-line lg:hidden">
        {rows.map((r) => (
          <Link key={r.payRunId} href={`/pay/${r.payRunId}`} prefetch={false} data-report-row="" className={PHONE_ROW}>
            <span className={ROW_GRID}>
              <span className="flex flex-col items-start gap-1">
                <span className="text-body-strong text-ink">{payRunPeriodText(r.period, today)}</span>
                <StatusChip status={r.status} plain />
                <span className={cx("text-meta text-ink", NO_WRAP)}>Employees <span className={FIG}>{formatMoney(r.employeesCents)}</span></span>
                <span className={cx("text-meta text-ink", NO_WRAP)}>Contractors <span className={FIG}>{formatMoney(r.contractorsCents)}</span></span>
              </span>
              <span data-total="" data-oneline="" className={cx(fig(r.totalCents), "text-right")}>{formatMoney(r.totalCents)}</span>
            </span>
            <Caret />
          </Link>
        ))}
      </div>
      <table className="hidden w-full lg:table">
        <thead>
          <tr>
            <th scope="col" className={TH}>Pay period</th>
            <th scope="col" className={TH}>Status</th>
            {["Employees", "Contractors", "GST", "Reimbursements"].map((h) => <th key={h} scope="col" className={cx(TH, "text-right", NO_WRAP)}>{h}</th>)}
            <th scope="col" className={cx(TH, "text-right", NO_WRAP)}>
              <span className={CHEVRON_GAP}>Total<ChevronSpacer /></span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.payRunId} data-report-row="" className="relative h-14 hover:bg-galv">
              <td className={TD}>
                <Link href={`/pay/${r.payRunId}`} prefetch={false} className={ROW_LINK}>{payRunPeriodText(r.period, today)}</Link>
              </td>
              <td className={TD}><StatusChip status={r.status} plain /></td>
              {[r.employeesCents, r.contractorsCents, r.gstCents, r.reimbursementsCents].map((c, i) => (
                <td key={i} className={cx(TD, "text-right")}><span className={fig(c)}>{formatMoney(c)}</span></td>
              ))}
              <td className={cx(TD, "text-right")}>
                <span className={CHEVRON_GAP}><span data-total="" className={fig(r.totalCents)}>{formatMoney(r.totalCents)}</span><TrailingChevron /></span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type ReportBody = (
  | { kind: "job-profitability"; rows: JobProfitRow[] }
  | { kind: "crew"; rows: CrewReportRow[] }
  | { kind: "productivity"; rows: ProductivityRow[] }
  | { kind: "pauses"; rows: PauseReportRow[] }
  | { kind: "pay-history"; rows: PayHistoryRow[] }
) & { keyFigure: ReportKeyFigure };

export type ReportFrameProps = { range: DateRange; chosen: boolean; today: string; updated: string | null };

/** Approved and exported runs first, $0.00 drafts below them (D21); the data order is kept inside each group. */
const draftsLast = (rows: PayHistoryRow[]): PayHistoryRow[] => [...rows.filter((r) => r.status !== "draft"), ...rows.filter((r) => r.status === "draft")];

/** One report (flows.md screen 22, `/reports/[kind]`): every row drills down to its source (job detail, crew detail). */
export function ReportView({ body, ...frame }: ReportFrameProps & { body: ReportBody }) {
  const empty = body.rows.length === 0;
  let content: React.ReactNode;
  if (empty) content = <NothingInRange kind={body.kind} chosen={frame.chosen} />;
  else if (body.kind === "job-profitability") content = <JobRows rows={body.rows} />;
  else if (body.kind === "crew") content = <CrewRows rows={body.rows} />;
  else if (body.kind === "productivity") content = <ProductivityRows rows={body.rows} today={frame.today} />;
  else if (body.kind === "pauses") content = <PauseRows rows={body.rows} />;
  else content = <PayHistoryRows rows={draftsLast(body.rows)} today={frame.today} />;
  return (
    <ReportFrame kind={body.kind} {...frame} empty={empty} open={empty || frame.chosen} figure={empty ? null : <KeyFigure figure={body.keyFigure} />}>
      {content}
    </ReportFrame>
  );
}

export function ReportSkeleton({ kind, ...frame }: ReportFrameProps & { kind: ReportKind }) {
  const figure = (
    <div className="flex flex-col gap-1 py-1 lg:col-span-2 lg:row-start-3">
      <Skeleton width={160} height={40} />
      <Skeleton width={200} height={14} />
    </div>
  );
  return (
    <ReportFrame kind={kind} {...frame} empty open={false} figure={figure}>
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
    <ReportFrame kind={kind} {...frame} empty open={false} figure={null}>
      <LoadError primary />
    </ReportFrame>
  );
}
