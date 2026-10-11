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
  if (first === "") return "home";
  const own = FIRST_SEGMENT_KEY[first];
  if (own === "outbox") return role === "foreman" ? own : "more";
  if (own) return own;
  // A foreman reaches Expenses from a job, so the receipts sit under Jobs.
  // The foreman has no More tab; their More page hangs off Home, so Home is the tab that is marked.
  if (role === "foreman") return first === "expenses" ? "jobs" : first === "more" ? "home" : "";
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

/**
 * Admin screens that need a connection to save: New job, Edit job, Edit expense (`?edit=1`), Crew (list, person, payout) and Workspace export (a download), every Settings page and More (Sign out and the theme need a connection too). Reports and Record history only
 * read, so nothing is entered there to send later. Everything else queues
 * entries on the device. The Crew list is read-only; it says "No signal. Balances as of 7:42 am." itself.
 */
export const queuesOffline = (pathname: string, edit: string | null = null): boolean =>
  !/^\/jobs\/(new|[^/]+\/edit)\/?$/.test(pathname) &&
  !/^\/crew(\/[^/]+(\/payout)?)?\/?$/.test(pathname) &&
  !/^\/pay(\/[^/]+)?\/?$/.test(pathname) &&
  !/^\/export\/?$/.test(pathname) &&
  !/^\/(reports(\/[^/]+)?|history)\/?$/.test(pathname) &&
  !/^\/(settings(\/.*)?|more)\/?$/.test(pathname) &&
  !(edit === "1" && /^\/expenses\/(?!new\/?$)[^/]+\/?$/.test(pathname));
