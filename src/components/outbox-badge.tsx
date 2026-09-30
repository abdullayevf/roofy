import Link from "next/link";
import { WarningDiamond } from "@phosphor-icons/react/dist/ssr";
import { cx } from "@/lib/cx";

export type OutboxBadgeProps = {
  /** Entries waiting to send ("3 to send"). */
  count: number;
  /** Entries that failed and need a person ("1 needs attention"); shown instead of the waiting count. */
  attention?: number;
  className?: string;
};

/**
 * DESIGN.md §4 outbox badge: `tape` pill "N to send" while entries wait, or an `over`-outlined pill
 * "1 entry needs attention" when one failed (it wins: a failed entry is the thing to act on). Links to /outbox,
 * hidden at 0. On phone the pill itself is the full 48 px tap target; on desktop the pill can read smaller
 * (40 px) while the link around it keeps the 48 px target (DESIGN.md §8).
 */
export function OutboxBadge({ count, attention = 0, className }: OutboxBadgeProps) {
  if (count === 0 && attention === 0) return null;
  return (
    <Link href="/outbox" prefetch={false} className={cx("inline-flex min-h-12 max-w-full items-center", className)}>
      {attention > 0 ? (
        <span className="flex min-h-12 items-center gap-2 rounded-full border-[1.5px] border-over bg-surface px-3 py-1 text-body-strong text-over lg:min-h-10">
          <WarningDiamond size={24} aria-hidden="true" className="shrink-0" />
          {attention === 1 ? "1 entry needs attention" : `${attention} entries need attention`}
        </span>
      ) : (
        <span className="flex min-h-12 items-center rounded-full bg-tape px-3 py-1 text-body-strong text-on-tape lg:min-h-10">
          {count} to send
        </span>
      )}
    </Link>
  );
}
