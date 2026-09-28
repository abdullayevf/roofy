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
};

export type ListProps = {
  rows: ListRow[];
  className?: string;
};

const ROW_LAYOUT =
  "flex min-h-[64px] lg:min-h-12 w-full items-center justify-between gap-4 px-4 py-2 text-left";
const FOCUS =
  "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-chalk";

function RowBody({ row }: { row: ListRow }) {
  const interactive = Boolean(row.href || row.onClick);
  return (
    <>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-body-strong text-ink">{row.primary}</span>
        {row.meta ? <span className="truncate text-meta text-ink-2">{row.meta}</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {row.figure}
        {interactive ? <CaretRight size={20} aria-hidden="true" className="text-ink-2" /> : null}
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
    <div className={cx("divide-y divide-line rounded-group bg-surface", className)}>
      {rows.map((row) => {
        if (row.href) {
          return (
            <Link key={row.key} href={row.href} className={cx(ROW_LAYOUT, FOCUS)}>
              <RowBody row={row} />
            </Link>
          );
        }
        if (row.onClick) {
          return (
            <button key={row.key} type="button" onClick={row.onClick} className={cx(ROW_LAYOUT, FOCUS)}>
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
