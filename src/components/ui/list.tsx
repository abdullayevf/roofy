import type { ReactNode, MouseEventHandler } from "react";
import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { cx } from "@/lib/cx";

export type ListRow = {
  key: string;
  primary: string;
  meta?: string;
  /** Right-aligned figure, typically a MoneyCell or StatusChip. */
  figure?: ReactNode;
  href?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  /** Demo-only: forces the inset focus ring so it shows up in a static screenshot. */
  focusVisible?: boolean;
};

export type ListProps = {
  rows: ListRow[];
  className?: string;
};

const ROW_LAYOUT =
  "flex min-h-[64px] w-full flex-wrap content-center items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2 text-left lg:min-h-12 lg:py-1";
const FOCUS =
  "focus-visible:outline focus-visible:outline-[3px] focus-visible:-outline-offset-3 focus-visible:outline-chalk-link";
/** Pressed state for a tappable row: a visible tint (colour is never the only feedback — the row also moves under the finger). */
const PRESSED = "active:bg-galv";
/** The same inset ring, always on (a static Focus sample). */
const FOCUS_FORCED = "outline outline-[3px] -outline-offset-3 outline-chalk-link";

function RowBody({ row }: { row: ListRow }) {
  const interactive = Boolean(row.href || row.onClick);
  return (
    <>
      <span className="flex min-w-0 flex-1 basis-32 flex-col">
        <span className="text-body-strong text-ink [overflow-wrap:anywhere]">{row.primary}</span>
        {row.meta ? <span className="text-meta text-ink-2 [overflow-wrap:anywhere]">{row.meta}</span> : null}
      </span>
      <span className="ml-auto flex max-w-full items-baseline gap-2">
        {row.figure}
        {interactive ? (
          <CaretRight size={24} aria-hidden="true" className="shrink-0 self-center text-ink-2" />
        ) : null}
      </span>
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
