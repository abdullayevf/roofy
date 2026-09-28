import Link from "next/link";
import { cx } from "@/lib/cx";

export type OutboxBadgeProps = {
  count: number;
  className?: string;
};

/**
 * DESIGN.md §4 outbox badge: `tape` pill "N to send", links to /outbox,
 * hidden at 0. On phone the pill itself is the full 48 px tap target; on
 * desktop the pill can read smaller (40 px) while the link around it keeps
 * the 48 px target (DESIGN.md §8).
 */
export function OutboxBadge({ count, className }: OutboxBadgeProps) {
  if (count === 0) return null;
  return (
    <Link href="/outbox" prefetch={false} className={cx("inline-flex h-12 items-center", className)}>
      <span className="flex h-12 items-center rounded-full bg-tape px-3 text-body-strong text-on-tape lg:h-10">
        {count} to send
      </span>
    </Link>
  );
}
