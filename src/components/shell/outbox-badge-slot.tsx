"use client";
import { usePathname } from "next/navigation";
import { OutboxBadge } from "@/components/outbox-badge";

/**
 * The outbox badge above the page. Home shows its own beside its title, so the shell's row stays out of the
 * way there (a layout gets no pathname, so this client component reads it).
 */
export function OutboxBadgeSlot({ waiting, attention }: { waiting: number; attention: number }) {
  const pathname = usePathname();
  if (pathname === "/" || (waiting === 0 && attention === 0)) return null;
  return (
    <div className="flex justify-end px-4 pt-2">
      <OutboxBadge count={waiting} attention={attention} />
    </div>
  );
}
