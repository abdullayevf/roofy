"use client";

import { useState } from "react";
import { CaretDown, CaretUp } from "@phosphor-icons/react";
import type { ProjectRowForeman, ProjectRowManager } from "@/data/contracts";
import { formatMoney } from "@/lib/format";
import { StatusChip, type Status } from "@/components/ui/status-chip";
import { daysSinceText, stageLine } from "./home-text";
import { FOCUS, GROUP, JobCard, JobFigures, whole } from "./home-parts";
import { showMoreText } from "./home-text";

/** How many jobs show before "Show N more" (a long history is one tap away, not a long scroll). */
export const JOBS_SHOWN = 20;

const CHIP: Record<ProjectRowForeman["status"], Status> = {
  active: "active",
  quoted: "quoted",
  on_hold: "on-hold",
  complete: "complete",
  closed: "closed",
};

/** A labour-budget sentence for a job's tape: "Trending $775.00 over its labour budget". */
function alertNote(alert: NonNullable<ProjectRowManager["alert"]>): { tone: "over" | "watch"; text: string } {
  const by = formatMoney(alert.byCents);
  return alert.level === "over"
    ? { tone: "over", text: `${by} over its labour budget` }
    : { tone: "watch", text: `Trending ${by} over its labour budget` };
}

function JobRow({ row, manager }: { row: ProjectRowForeman | ProjectRowManager; manager: boolean }) {
  const money = manager ? (row as ProjectRowManager) : null;
  const note = money?.alert ? alertNote(money.alert) : null;
  return (
    <JobCard
      href={`/jobs/${row.id}`}
      name={row.name}
      lines={[row.siteAddress, stageLine(row.currentStages)]}
      tape={{ label: `${row.name} progress`, percent: whole(row.pctBp), tone: note?.tone, note: note?.text }}
    >
      {row.status !== "active" ? <StatusChip plain status={CHIP[row.status]} className="mt-2" /> : null}
      {money ? (
        <JobFigures
          labourActualCents={money.labourActualCents}
          labourBudgetCents={money.labourBudgetCents}
          forecastMarginCents={money.forecastMarginCents}
          daysSinceLastLog={money.daysSinceLastLog}
        />
      ) : (
        <span className="mt-2 block text-meta text-ink">{daysSinceText(row.daysSinceLastLog)}</span>
      )}
    </JobCard>
  );
}

/** The job cards in one group. Past `JOBS_SHOWN` the rest open in place from a full-width "Show N more" row. */
export function JobsGroup({ rows, manager }: { rows: (ProjectRowForeman | ProjectRowManager)[]; manager: boolean }) {
  const [open, setOpen] = useState(false);
  const shown = open ? rows : rows.slice(0, JOBS_SHOWN);
  const rest = rows.length - JOBS_SHOWN;
  return (
    <div className={GROUP}>
      {shown.map((row) => (
        <JobRow key={row.id} row={row} manager={manager} />
      ))}
      {rest > 0 ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-body-strong text-ink first:rounded-t-group last:rounded-b-group active:bg-galv ${FOCUS}`}
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
  );
}
