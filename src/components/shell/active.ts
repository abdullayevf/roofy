import type { TabBarRole } from "@/components/nav/tab-bar";

export type NavRole = TabBarRole;
export type NavLayout = "phone" | "desktop";

const FIRST_SEGMENT_KEY: Record<string, string> = {
  jobs: "jobs",
  log: "log",
  crew: "crew",
  outbox: "outbox",
};

/** Pages a manager reaches from More on a phone; the desktop sidebar lists four of them itself. */
const MORE_PAGES = new Set(["more", "expenses", "pay", "reports", "settings", "history", "export", "install"]);
const MANAGE_PAGES = new Set(["expenses", "pay", "reports", "settings"]);

/**
 * Which primary nav item is active for a pathname (the nav components take the active key as a prop).
 * "" means none of the role's items is: the foreman on a page outside Log, Jobs and Outbox, say.
 */
export function activeNavKey(pathname: string, role: NavRole, layout: NavLayout): string {
  const first = pathname.split("/")[1] ?? "";
  if (first === "") return role === "foreman" ? "" : "home";
  const own = FIRST_SEGMENT_KEY[first];
  if (own) return role === "foreman" || own !== "outbox" ? own : "";
  if (role === "foreman") return "";
  if (role === "accountant" && (first === "pay" || first === "reports")) return first;
  if (layout === "desktop" && role === "manager" && MANAGE_PAGES.has(first)) return "";
  return MORE_PAGES.has(first) ? "more" : "";
}

export type ManageItem = { key: string; label: string; href: string };

/**
 * Desktop only: the sidebar has room for the pages a phone keeps under More. The `Sidebar` component
 * shows the same items as the tab bar, so the shell adds these beneath it.
 */
export function manageNavItems(role: NavRole): ManageItem[] {
  if (role !== "manager") return [];
  return [
    { key: "expenses", label: "Expenses", href: "/expenses" },
    { key: "pay", label: "Pay runs", href: "/pay" },
    { key: "reports", label: "Reports", href: "/reports" },
    { key: "settings", label: "Settings", href: "/settings" },
  ];
}

/** The manage item a pathname belongs to, or "". */
export function activeManageKey(pathname: string): string {
  const first = pathname.split("/")[1] ?? "";
  return MANAGE_PAGES.has(first) ? first : "";
}
