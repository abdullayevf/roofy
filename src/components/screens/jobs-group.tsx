"use client";

import { useState } from "react";
import Link from "next/link";
import { CaretDown, CaretRight, CaretUp, WarningCircle, WarningDiamond } from "@phosphor-icons/react";
import type { ProjectList, ProjectRowForeman, ProjectRowManager } from "@/data/contracts";
import { cx } from "@/lib/cx";
import { formatMoney } from "@/lib/format";
import { KeepTogether } from "@/components/keep-together";
import { TapeBar } from "@/components/tape-bar";
import { Field } from "@/components/ui/field";
import { StatusChip } from "@/components/ui/status-chip";
import { FOCUS, GROUP, whole } from "./home-parts";
import { showMoreText } from "./home-text";
import { jobLine, lastLogOn, type JobLine } from "./job-input";

/** How many jobs show before "Show N more" (a long history is one tap away, not a long scroll). */
export const JOBS_SHOWN = 20;

type Item = { row: ProjectRowForeman; money: ProjectRowManager | null };

/** The one status line: the alert with its icon, or a chip and the current stages. */
function StatusLine({ line }: { line: JobLine }) {
  if (line.alert) {
    const over = line.alert.tone === "over";
    const Glyph = over ? WarningCircle : WarningDiamond;
    return (
      <span data-job-status="" className={cx("flex items-start gap-1.5 text-meta", over ? "text-over" : "text-watch")}>
        <Glyph size={20} aria-hidden="true" className="shrink-0" />
        <span className="[overflow-wrap:anywhere]">{line.alert.text}</span>
      </span>
    );
  }
  return (
    <span data-job-status="" className="flex flex-wrap items-center gap-x-2 text-meta text-ink">
      {line.chip ? <StatusChip plain status={line.chip.status} reason={line.chip.reason} /> : null}
      {line.text ? <span className="[overflow-wrap:anywhere]">{line.text}</span> : null}
    </span>
  );
}

/** Labour so far against its budget: the row's one figure. */
function LabourFigure({ money }: { money: ProjectRowManager }) {
  return (
    <span className="flex items-baseline justify-end gap-1.5 whitespace-nowrap">
      <span className="text-figure num text-ink">{formatMoney(money.labourActualCents)}</span>
      <span className="text-meta text-ink">of {formatMoney(money.labourBudgetCents)}</span>
    </span>
  );
}

/** A phone or tablet row (DESIGN.md §4 list row): name, one status line, the tape bar, one figure. */
function PhoneRow({ item }: { item: Item }) {
  const { row, money } = item;
  return (
    <Link
      href={`/jobs/${row.id}`}
      prefetch={false}
      data-job-row=""
      className={cx("block min-h-16 px-4 py-2 first:rounded-t-group last:rounded-b-group active:bg-galv", FOCUS)}
    >
      <span className="flex items-start justify-between gap-3">
        <span data-job-name="" className="min-w-0 text-body-strong text-ink [overflow-wrap:anywhere]">
          <KeepTogether text={row.name} />
        </span>
        <CaretRight size={24} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-2" />
      </span>
      <StatusLine line={jobLine({ ...row, alert: money?.alert, alertStageName: money?.alertStageName })} />
      <TapeBar label={`${row.name} progress`} percent={whole(row.pctBp)} />
      {money ? <LabourFigure money={money} /> : null}
    </Link>
  );
}

const TH = "px-4 py-2 text-left text-meta text-ink font-normal";
// A chip line is 24 px tall (its icon), so with the 24 px name the cell is 48 px; py-0.5 keeps the row at 53 px, under the 56 px cap.
const TD = "px-4 py-0.5 align-middle";

/** From 1024 px: a table with the whole row as the link. Job, how far along, labour of budget, margin, last log. */
function JobsTable({ items, today }: { items: Item[]; today: string }) {
  const manager = items.some((i) => i.money);
  return (
    <table className="hidden w-full lg:table">
      <thead>
        <tr>
          <th scope="col" className={TH}>Job</th>
          <th scope="col" className={cx(TH, "w-40")}>Done</th>
          {manager ? <th scope="col" className={cx(TH, "text-right")}>Labour of budget</th> : null}
          {manager ? <th scope="col" className={cx(TH, "text-right")}>Margin</th> : null}
          <th scope="col" className={cx(TH, "text-right")}>Last log</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {items.map(({ row, money }) => (
          <tr key={row.id} data-job-row="" className="relative h-12 hover:bg-galv">
            <td className={TD}>
              <Link
                href={`/jobs/${row.id}`}
                prefetch={false}
                className={cx("block text-body-strong text-ink after:absolute after:inset-0", FOCUS)}
              >
                <KeepTogether text={row.name} />
              </Link>
              <StatusLine line={jobLine({ ...row, alert: money?.alert, alertStageName: money?.alertStageName })} />
            </td>
            <td className={TD}>
              <span className="text-figure num text-ink">{whole(row.pctBp)}%</span>
            </td>
            {money ? (
              <td className={cx(TD, "text-right")}>
                <LabourFigure money={money} />
              </td>
            ) : null}
            {money ? <td className={cx(TD, "text-right text-figure num text-ink")}>{formatMoney(money.forecastMarginCents)}</td> : null}
            <td className={cx(TD, "text-right text-body text-ink")}>{lastLogOn(row.daysSinceLastLog, today)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The jobs in one group. Past `JOBS_SHOWN` there is a search by name or address (a long history is found, not scrolled)
 * and the rest open in place from a full-width "Show N more" row.
 */
export function JobsGroup({ list, today }: { list: ProjectList; today: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const everyone: Item[] =
    list.view === "manager"
      ? list.rows.map((r) => ({ row: r, money: r }))
      : list.rows.map((r) => ({ row: r, money: null }));
  const q = query.trim().toLowerCase();
  const all = q ? everyone.filter(({ row }) => `${row.name} ${row.siteAddress}`.toLowerCase().includes(q)) : everyone;
  const shown = open ? all : all.slice(0, JOBS_SHOWN);
  const rest = all.length - JOBS_SHOWN;
  return (
    <div className="flex flex-col gap-4">
      {everyone.length > JOBS_SHOWN ? (
        <Field label="Search jobs" inputMode="search" type="search" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
      ) : null}
      {all.length === 0 ? (
        <p className="text-body text-ink">No job matches &ldquo;{query.trim()}&rdquo;.</p>
      ) : (
        <div className={cx(GROUP, "overflow-hidden")}>
          <div className="divide-y divide-line lg:hidden">
            {shown.map((item) => (
              <PhoneRow key={item.row.id} item={item} />
            ))}
          </div>
          <JobsTable items={shown} today={today} />
          {rest > 0 ? (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className={`flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-body-strong text-ink active:bg-galv ${FOCUS}`}
            >
              {open ? "Show fewer" : showMoreText(rest)}
              {open ? (
                <CaretUp size={24} aria-hidden="true" className="shrink-0 text-ink-2" />
              ) : (
                <CaretDown size={24} aria-hidden="true" className="shrink-0 text-ink-2" />
              )}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
