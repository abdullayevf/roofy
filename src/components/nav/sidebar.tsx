import Link from "next/link";
import {
  Briefcase,
  ChartBar,
  CurrencyCircleDollar,
  House,
  NotePencil,
  SquaresFour,
  Tray,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { cx } from "@/lib/cx";

export type SidebarRole = "manager" | "foreman" | "accountant";

type Item = { key: string; label: string; href: string; icon: PhosphorIcon };

const ITEMS: Record<SidebarRole, Item[]> = {
  manager: [
    { key: "home", label: "Home", href: "/", icon: House },
    { key: "jobs", label: "Jobs", href: "/jobs", icon: Briefcase },
    { key: "log", label: "Log", href: "/log", icon: NotePencil },
    { key: "crew", label: "Crew", href: "/crew", icon: UsersThree },
    { key: "more", label: "More", href: "/more", icon: SquaresFour },
  ],
  foreman: [
    { key: "log", label: "Log", href: "/log", icon: NotePencil },
    { key: "jobs", label: "Jobs", href: "/jobs", icon: Briefcase },
    { key: "outbox", label: "Outbox", href: "/outbox", icon: Tray },
  ],
  accountant: [
    { key: "home", label: "Home", href: "/", icon: House },
    { key: "pay", label: "Pay", href: "/pay", icon: CurrencyCircleDollar },
    { key: "reports", label: "Reports", href: "/reports", icon: ChartBar },
    { key: "more", label: "More", href: "/more", icon: SquaresFour },
  ],
};

export type SidebarProps = {
  role: SidebarRole;
  active: string;
  workspaceName: string;
  className?: string;
};

/** DESIGN.md §4 navigation, desktop >= 1024: 240 px sidebar, same items as the phone tab bar. */
export function Sidebar({ role, active, workspaceName, className }: SidebarProps) {
  const items = ITEMS[role];
  return (
    <nav
      aria-label="Primary"
      className={cx("flex w-[240px] shrink-0 flex-col gap-1 border-r border-line bg-surface p-4", className)}
    >
      <p className="mb-4 text-heading text-ink">{workspaceName}</p>
      {items.map((item) => {
        const isActive = item.key === active;
        const Glyph = item.icon;
        return (
          <Link
            key={item.key}
            href={item.href}
            prefetch={false}
            aria-current={isActive ? "page" : undefined}
            className={cx(
              "flex min-h-12 items-center gap-3 rounded-control px-3 text-body-strong",
              isActive ? "bg-chalk text-on-chalk" : "text-ink",
            )}
          >
            <Glyph size={24} weight={isActive ? "fill" : "regular"} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
