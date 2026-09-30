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
    { key: "home", label: "Home", href: "/", icon: House },
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
  /** Extra text-only items beneath the icon items (the desktop shell's manager pages), under a "Manage" label. */
  extra?: { key: string; label: string; href: string }[];
  /** Key of the active extra item. */
  activeExtra?: string;
  /** Demo-only: forces the focus ring on one item (by key) so it shows up in a static screenshot. */
  focusKey?: string;
  className?: string;
};

/** The active item's 4 px `ink` edge bar (with a filled icon and a `galv` background): never a chalk fill, chalk is for actions. */
function ActiveBar() {
  return <span aria-hidden="true" className="absolute inset-y-2 left-0 w-1 rounded-full bg-ink" />;
}

/** DESIGN.md §4 navigation, desktop >= 1024: 240 px sidebar, same items as the phone tab bar. */
export function Sidebar({
  role,
  active,
  workspaceName,
  extra,
  activeExtra,
  focusKey,
  className,
}: SidebarProps) {
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
              "relative flex min-h-12 items-center gap-3 rounded-control px-3 text-body-strong text-ink",
              isActive && "bg-galv",
              focusRing(focusKey === item.key),
            )}
          >
            {isActive ? <ActiveBar /> : null}
            <Glyph size={24} weight={isActive ? "fill" : "regular"} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
      {extra && extra.length > 0 ? (
        <>
          <p className="mb-1 mt-4 px-3 text-meta text-ink-2">Manage</p>
          {extra.map((item) => {
            const isActive = item.key === activeExtra;
            return (
              <Link
                key={item.key}
                href={item.href}
                prefetch={false}
                aria-current={isActive ? "page" : undefined}
                className={cx(
                  "relative flex min-h-12 items-center rounded-control pl-12 pr-3 text-body-strong text-ink",
                  isActive && "bg-galv",
                  focusRing(false),
                )}
              >
                {isActive ? <ActiveBar /> : null}
                {item.label}
              </Link>
            );
          })}
        </>
      ) : null}
    </nav>
  );
}
