import type { NavRole } from "./active";

/** The four prototype roles (same union as `Role` in `@/data/contracts`, which components may only import as a type). */
export type ShellRole = "owner" | "manager" | "foreman" | "accountant";

/** Owner and manager share the manager nav. */
export function navRoleFor(role: ShellRole): NavRole {
  return role === "owner" ? "manager" : role;
}

export type Section =
  | "home"
  | "jobs"
  | "log"
  | "crew"
  | "more"
  | "outbox"
  | "pay"
  | "reports"
  | "expenses"
  | "settings"
  | "history"
  | "export"
  | "install";

const FOREMAN: readonly Section[] = ["jobs", "log", "outbox", "expenses", "install"];
const ACCOUNTANT: readonly Section[] = ["home", "jobs", "pay", "reports", "expenses", "more", "install"];

/**
 * Product spec §3. The foreman sees no money and no admin pages (they add expenses); the accountant
 * is read-only on pay, expenses and reports (no logging, crew, settings, history or export).
 */
export function canOpen(role: ShellRole, section: Section): boolean {
  if (role === "foreman") return FOREMAN.includes(section);
  if (role === "accountant") return ACCOUNTANT.includes(section);
  return true;
}

export type MoreItem = { key: string; label: string; href: string; meta: string };

const ALL_MORE: (MoreItem & { section: Section })[] = [
  { section: "expenses", key: "expenses", label: "Expenses", href: "/expenses", meta: "Receipts and who paid" },
  { section: "pay", key: "pay", label: "Pay runs", href: "/pay", meta: "Review, approve and export" },
  { section: "reports", key: "reports", label: "Reports", href: "/reports", meta: "How each job is tracking" },
  { section: "settings", key: "settings", label: "Settings", href: "/settings", meta: "Business, rates and theme" },
  { section: "history", key: "history", label: "Record history", href: "/history", meta: "Who changed what, and when" },
  { section: "export", key: "export", label: "Workspace export", href: "/export", meta: "Download your data" },
  { section: "install", key: "install", label: "Install guide", href: "/install", meta: "Put Roofy on your home screen" },
];

/** Rows of the More menu for a role: only pages it can open (foreman has no More). */
export function moreItems(role: ShellRole): MoreItem[] {
  if (role === "foreman") return [];
  // The accountant's tab bar already has Pay and Reports.
  const inTabs: Section[] = role === "accountant" ? ["pay", "reports"] : [];
  return ALL_MORE.filter((i) => canOpen(role, i.section) && !inTabs.includes(i.section)).map((i) => ({ key: i.key, label: i.label, href: i.href, meta: i.meta }));
}

/** The way back from a no-permission or error state. */
export function backLink(role: ShellRole): { href: string; label: string } {
  return role === "foreman" ? { href: "/log", label: "Back to Log" } : { href: "/", label: "Go to Home" };
}
