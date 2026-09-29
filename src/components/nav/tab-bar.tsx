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
import { focusRing } from "@/components/ui/focus";

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
  /** Demo-only: forces the focus ring on one item (by key) so it shows up in a static screenshot. */
  focusKey?: string;
  className?: string;
};

/**
 * DESIGN.md §4 navigation, phone: bottom tab bar. Log is a raised `chalk`
 * circle (manager/foreman) that lifts 1.5 rem above the bar — leave that much
 * clearance above it, and pad a page's bottom with `pb-tab-bar` (which
 * accounts for the raise and the safe area). The active tab uses a Phosphor
 * Fill icon and `chalk-link` text; inactive tabs use Regular and `ink-2`.
 * Labels are Barlow Semi Condensed and wrap rather than overflow at large
 * text sizes.
 */
export function TabBar({ role, active, fixed = true, focusKey, className }: TabBarProps) {
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
        const ring = focusRing(focusKey === item.key);
        if (item.raised) {
          return (
            <Link
              prefetch={false}
              key={item.key}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cx(
                "relative flex min-h-16 min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-control px-1 pb-2 pt-1",
                ring,
              )}
            >
              <span className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-chalk shadow-sheet">
                <Glyph
                  size={24}
                  weight={isActive ? "fill" : "regular"}
                  aria-hidden="true"
                  className="text-on-chalk"
                />
              </span>
              <span className="max-w-full text-center text-tab text-ink [overflow-wrap:anywhere]">
                {item.label}
              </span>
            </Link>
          );
        }
        return (
          <Link
            prefetch={false}
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cx(
              "flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-control px-1 py-2",
              ring,
            )}
          >
            <Glyph
              size={24}
              weight={isActive ? "fill" : "regular"}
              aria-hidden="true"
              className={isActive ? "text-chalk-link" : "text-ink-2"}
            />
            <span
              className={cx(
                "max-w-full text-center text-tab [overflow-wrap:anywhere]",
                isActive ? "text-chalk-link" : "text-ink-2",
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
