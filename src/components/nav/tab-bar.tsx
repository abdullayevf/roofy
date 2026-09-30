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
    { key: "home", label: "Home", href: "/", icon: House },
    { key: "jobs", label: "Jobs", href: "/jobs", icon: Briefcase },
    { key: "log", label: "Log", href: "/log", icon: NotePencil, raised: true },
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
  /** Entries on this device waiting or failed: a count chip on the Outbox tab (the foreman's bar). */
  outboxCount?: number;
  /** One of those entries needs attention: the chip turns `over` red. */
  outboxAttention?: boolean;
  /** Demo-only: forces the focus ring on one item (by key) so it shows up in a static screenshot. */
  focusKey?: string;
  /** Pads the bottom for the home-bar inset. Defaults to `fixed`: only the bar actually pinned at the bottom needs it. */
  inset?: boolean;
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
export function TabBar({ role, active, fixed = true, outboxCount = 0, outboxAttention = false, focusKey, inset = fixed, className }: TabBarProps) {
  const items = ITEMS[role];
  return (
    <nav
      aria-label="Primary"
      className={cx(
        fixed && "fixed inset-x-0 bottom-0 z-30",
        "flex items-stretch justify-around border-t border-line bg-surface",
        className,
      )}
      style={inset ? { paddingBottom: "max(var(--sab-sim, 0px), env(safe-area-inset-bottom))" } : undefined}
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
              <span
                className={cx(
                  "max-w-full text-center text-tab [overflow-wrap:anywhere]",
                  isActive ? "text-chalk-link" : "text-ink",
                )}
              >
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
            <span className="relative">
              <Glyph
                size={24}
                weight={isActive ? "fill" : "regular"}
                aria-hidden="true"
                className={isActive ? "text-chalk-link" : "text-ink-2"}
              />
              {item.key === "outbox" && outboxCount > 0 ? (
                <>
                  <span
                    aria-hidden="true"
                    className={cx(
                      "absolute -right-3 -top-2 flex min-w-5 items-center justify-center rounded-full px-1 text-tab",
                      outboxAttention ? "bg-over-fill text-on-over-fill" : "bg-tape text-on-tape",
                    )}
                  >
                    {outboxCount}
                  </span>
                  <span className="sr-only">{outboxAttention ? `${outboxCount} to send, one needs attention` : `${outboxCount} to send`}</span>
                </>
              ) : null}
            </span>
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
