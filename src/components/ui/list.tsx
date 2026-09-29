import type { ReactNode, MouseEventHandler } from "react";
import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { cx } from "@/lib/cx";
import { StatusLine, type MoneyTone } from "./money-cell";

export type ListRow = {
  key: string;
  primary: string;
  meta?: string;
  /** Right-aligned figure, typically a MoneyCell or StatusChip. */
  figure?: ReactNode;
  href?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  /**
   * A status sentence for the row ("Trending $775.00 over budget"): full width
   * under the label and figure, from the label's left edge, so the figure and
   * chevron stay alone on the right and the label and figure share one line.
   */
  status?: { tone: MoneyTone; text: string };
  /** Demo-only: forces the inset focus ring so it shows up in a static screenshot. */
  focusVisible?: boolean;
};

export type ListProps = {
  rows: ListRow[];
  className?: string;
};

// Rounded like the group at its first and last row, so a focus ring follows the container's corners.
const ROW_LAYOUT =
  "flex min-h-[64px] w-full flex-wrap gap-x-4 px-4 text-left first:rounded-t-group last:rounded-b-group lg:min-h-12";
const FOCUS =
  "focus-visible:outline focus-visible:outline-[3px] focus-visible:-outline-offset-3 focus-visible:outline-chalk-link";
/** Pressed state for a tappable row: a visible tint (colour is never the only feedback — the row also moves under the finger). */
const PRESSED = "active:bg-galv";
/** The same inset ring, always on (a static Focus sample). */
const FOCUS_FORCED = "outline outline-[3px] -outline-offset-3 outline-chalk-link";

/**
 * The label block wraps; the right column (figure or chip, then the chevron)
 * is fixed and never moves — a long label can't push a chip or a figure onto
 * a second line.
 */
function RowBody({ row }: { row: ListRow }) {
  const interactive = Boolean(row.href || row.onClick);
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col justify-center py-2 lg:py-1">
        <span className="text-body-strong text-ink [overflow-wrap:anywhere]">{row.primary}</span>
        {row.meta ? <span className="text-meta text-ink-2 [overflow-wrap:anywhere]">{row.meta}</span> : null}
      </span>
      {row.figure || interactive ? (
        <span className="flex max-w-[60%] shrink-0 items-center gap-2 py-2 lg:py-1">
          {row.figure}
          {interactive ? <CaretRight size={24} aria-hidden="true" className="shrink-0 text-ink-2" /> : null}
        </span>
      ) : null}
      {row.status ? (
        <StatusLine tone={row.status.tone} text={row.status.text} className="basis-full pb-2" />
      ) : null}
    </>
  );
}

/**
 * DESIGN.md §4 list row: grouped surface block, line dividers, 64/48 px
 * rows. The whole row is the tap target when it has an `href` or `onClick`.
 */
export function List({ rows, className }: ListProps) {
  return (
    <div className={cx("divide-y divide-line rounded-group bg-surface border-group", className)}>
      {rows.map((row) => {
        if (row.href) {
          return (
            <Link
              key={row.key}
              href={row.href}
              prefetch={false}
              className={cx(ROW_LAYOUT, row.focusVisible ? FOCUS_FORCED : FOCUS, PRESSED)}
            >
              <RowBody row={row} />
            </Link>
          );
        }
        if (row.onClick) {
          return (
            <button
              key={row.key}
              type="button"
              onClick={row.onClick}
              className={cx(ROW_LAYOUT, row.focusVisible ? FOCUS_FORCED : FOCUS, PRESSED)}
            >
              <RowBody row={row} />
            </button>
          );
        }
        return (
          <div key={row.key} className={ROW_LAYOUT}>
            <RowBody row={row} />
          </div>
        );
      })}
    </div>
  );
}
