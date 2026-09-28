import Link from "next/link";
import { cx } from "@/lib/cx";

export type OutboxBadgeProps = {
  count: number;
  className?: string;
};

/** DESIGN.md §4 outbox badge: `tape` pill "N to send", links to /outbox, hidden at 0. */
export function OutboxBadge({ count, className }: OutboxBadgeProps) {
  if (count === 0) return null;
  return (
    <Link
      href="/outbox"
      className={cx(
        "inline-flex h-8 items-center rounded-full bg-tape px-3 text-meta text-on-tape",
        className,
      )}
    >
      {count} to send
    </Link>
  );
}
