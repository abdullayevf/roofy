import Link from "next/link";
import { cx } from "@/lib/cx";

export type OutboxBadgeProps = {
  count: number;
  className?: string;
};

/**
 * DESIGN.md §4 outbox badge: `tape` pill "N to send", links to /outbox,
 * hidden at 0. The pill itself stays visually small; the link around it
 * (the real tap target) is padded out to the 48 px minimum (DESIGN.md §8)
 * without inflating the pill's own height.
 */
export function OutboxBadge({ count, className }: OutboxBadgeProps) {
  if (count === 0) return null;
  return (
    <Link href="/outbox" className={cx("inline-flex min-h-12 items-center", className)}>
      <span className="inline-flex h-8 items-center rounded-full bg-tape px-3 text-meta text-on-tape">
        {count} to send
      </span>
    </Link>
  );
}
