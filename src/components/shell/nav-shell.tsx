"use client";
/**
 * The primary navigation for the app shell: the phone tab bar (below 1024 px) and the desktop
 * sidebar (1024 px and up). A layout gets no pathname, so this client component reads it and picks
 * the active item with `activeNavKey`. Both navs are in the DOM; CSS shows one (the hidden one is
 * `display: none`, so it is out of the accessibility tree and the tab order).
 */
import { usePathname, useSearchParams } from "next/navigation";
import { TabBar } from "@/components/nav/tab-bar";
import { Sidebar } from "@/components/nav/sidebar";
import { useWaitingCount } from "@/offline/waiting";
import { outboxHref } from "./demo-href";
import { activeManageKey, activeNavKey, manageNavItems, type NavRole } from "./active";

export function ShellSidebar({ role, workspaceName, outboxCount, outboxAttention }: { role: NavRole; workspaceName: string; outboxCount: number; outboxAttention: boolean }) {
  const pathname = usePathname();
  const outbox = outboxHref(useSearchParams()?.get("demo"));
  const count = outboxCount + useWaitingCount();
  return (
    <Sidebar
      role={role}
      active={activeNavKey(pathname, role, "desktop")}
      workspaceName={workspaceName}
      outboxCount={count}
      outboxAttention={outboxAttention}
      outboxHref={outbox}
      extra={manageNavItems(role)}
      activeExtra={activeManageKey(pathname)}
      className="min-h-dvh"
    />
  );
}

export function ShellTabBar({ role, outboxCount, outboxAttention }: { role: NavRole; outboxCount: number; outboxAttention: boolean }) {
  const pathname = usePathname();
  const outbox = outboxHref(useSearchParams()?.get("demo"));
  const count = outboxCount + useWaitingCount();
  // Left and right padding keeps the outer tabs clear of the notch and rounded corners in landscape.
  return (
    <TabBar
      role={role}
      outboxCount={count}
      outboxAttention={outboxAttention}
      outboxHref={outbox}
      active={activeNavKey(pathname, role, "phone")}
      className="pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
    />
  );
}
