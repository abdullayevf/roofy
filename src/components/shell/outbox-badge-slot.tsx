"use client";
import { usePathname } from "next/navigation";
import { OutboxBadge } from "@/components/outbox-badge";
import { useWaitingCount } from "@/offline/waiting";

/**
 * The outbox badge above the page, on the same left edge as the page's column. Home shows its own beside its title,
 * and the Outbox page is the list itself, so the shell's row stays out of the way on both (a layout gets no pathname,
 * so this client component reads it). Entries saved on this phone with no signal count too.
 */
export function OutboxBadgeSlot({ waiting, attention }: { waiting: number; attention: number }) {
  const pathname = usePathname();
  const count = waiting + useWaitingCount();
  if (pathname === "/" || pathname === "/outbox" || (count === 0 && attention === 0)) return null;
  return (
    <div className="flex justify-start px-4 pt-2">
      <OutboxBadge count={count} attention={attention} />
    </div>
  );
}
