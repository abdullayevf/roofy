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

export type TabBarRole = "manager" | "foreman" | "accountant";

type Item = { key: string; label: string; href: string; icon: PhosphorIcon; raised?: boolean };

const ITEMS: Record<TabBarRole, Item[]> = {
  manager: [
    { key: "home", label: "Home", href: "/", icon: House },
    { key: "jobs", label: "Jobs", href: "/jobs", icon: Briefcase },
    { key: "log", label: "Log", href: "/log", icon: NotePencil, raised: true },
    { key: "crew", label: "Crew", href: "/crew", icon: UsersThree },
    { key: "more", label: "More", href: "/more", icon: SquaresFour },
  ],
  foreman: [
    { key: "log", label: "Log", href: "/log", icon: NotePencil, raised: true },
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

export type TabBarProps = {
  role: TabBarRole;
  /** Key of the active item, e.g. "home". */
  active: string;
  /**
   * `true` (the default, real app usage) pins the bar to the bottom of the
   * viewport. The gallery renders it `false` so the demo sits in normal
   * document flow instead of covering the rest of the page.
   */
  fixed?: boolean;
  className?: string;
};

/**
 * DESIGN.md §4 navigation, phone: bottom tab bar. Log is a raised `chalk`
 * circle (manager/foreman). The active tab uses a Phosphor Fill icon and
 * `chalk` text; inactive tabs use Regular and `ink-2`. Sits above the home
 * indicator via a safe-area-aware padding-bottom.
 */
export function TabBar({ role, active, fixed = true, className }: TabBarProps) {
  const items = ITEMS[role];
  return (
    <nav
      aria-label="Primary"
      className={cx(
        fixed && "fixed inset-x-0 bottom-0 z-30",
        "flex items-stretch justify-around border-t border-line bg-surface",
        className,
      )}
      style={{ paddingBottom: "max(var(--sab-sim, 0px), env(safe-area-inset-bottom))" }}
    >
      {items.map((item) => {
        const isActive = item.key === active;
        const Glyph = item.icon;
        if (item.raised) {
          return (
            <Link
              prefetch={false}
              key={item.key}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className="relative flex min-w-12 flex-1 flex-col items-center justify-end gap-1 pb-2 pt-1 text-meta"
            >
              <span className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-chalk shadow-sheet">
                <Glyph
                  size={28}
                  weight={isActive ? "fill" : "regular"}
                  aria-hidden="true"
                  className="text-on-chalk"
                />
              </span>
              <span className="text-ink">{item.label}</span>
            </Link>
          );
        }
        return (
          <Link
            prefetch={false}
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className="flex min-h-12 min-w-12 flex-1 flex-col items-center justify-center gap-1 py-2 text-meta"
          >
            <Glyph
              size={24}
              weight={isActive ? "fill" : "regular"}
              aria-hidden="true"
              className={isActive ? "text-chalk-link" : "text-ink-2"}
            />
            <span className={isActive ? "text-chalk-link" : "text-ink-2"}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
