"use client";
/**
 * The primary navigation for the app shell: the phone tab bar (below 1024 px) and the desktop
 * sidebar (1024 px and up). A layout gets no pathname, so this client component reads it and picks
 * the active item with `activeNavKey`. Both navs are in the DOM; CSS shows one (the hidden one is
 * `display: none`, so it is out of the accessibility tree and the tab order).
 */
import { usePathname } from "next/navigation";
import { TabBar } from "@/components/nav/tab-bar";
import { Sidebar } from "@/components/nav/sidebar";
import { activeManageKey, activeNavKey, manageNavItems, type NavRole } from "./active";

export function ShellSidebar({ role, workspaceName }: { role: NavRole; workspaceName: string }) {
  const pathname = usePathname();
  return (
    <Sidebar
      role={role}
      active={activeNavKey(pathname, role, "desktop")}
      workspaceName={workspaceName}
      extra={manageNavItems(role)}
      activeExtra={activeManageKey(pathname)}
      className="min-h-dvh"
    />
  );
}

export function ShellTabBar({ role }: { role: NavRole }) {
  const pathname = usePathname();
  return <TabBar role={role} active={activeNavKey(pathname, role, "phone")} />;
}
