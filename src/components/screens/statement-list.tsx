"use client";

import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import type { StatementRef } from "@/data/contracts";
import { cx } from "@/lib/cx";
import { FOCUS, GROUP } from "./home-parts";
import { StatementRow } from "./statement-row";

/** How many statements show before "See all statements". */
export const LATEST_STATEMENTS = 4;

/**
 * The latest four statements, each with Share; "See all statements" opens the rest in place (there is no
 * all-statements page yet), so Rates and Recent logs stay a short scroll away.
 */
export function StatementList({
  statements,
  crewMemberId,
  today,
  demoOffline,
}: {
  statements: StatementRef[];
  crewMemberId: string;
  today: string;
  demoOffline: boolean;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? statements : statements.slice(0, LATEST_STATEMENTS);
  return (
    <>
      <div data-statements="" className={cx(GROUP, "divide-y")}>
        {shown.map((s) => (
          <StatementRow key={s.payRunId} statement={s} crewMemberId={crewMemberId} today={today} demoOffline={demoOffline} />
        ))}
      </div>
      {!all && statements.length > LATEST_STATEMENTS ? (
        <div className={GROUP}>
          <button
            type="button"
            aria-expanded={false}
            onClick={() => setAll(true)}
            className={cx("flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-body-strong text-ink active:bg-galv", FOCUS)}
          >
            See all statements
            <CaretDown size={24} aria-hidden="true" className="shrink-0 text-ink-2" />
          </button>
        </div>
      ) : null}
    </>
  );
}
