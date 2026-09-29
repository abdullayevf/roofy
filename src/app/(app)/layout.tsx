import type { Metadata } from "next";
import { getData } from "@/data";
import { OfflineBanner } from "@/components/offline-banner";
import { OutboxBadge } from "@/components/outbox-badge";
import { ShellSidebar, ShellTabBar } from "@/components/shell/nav-shell";
import { navRoleFor } from "@/components/shell/access";

export const metadata: Metadata = {
  title: { template: "%s | Roofy", default: "Roofy" },
};

/** The workspace name for the sidebar; "Roofy" when the data can't be read (`?demo=error`, `?demo=noperm`). */
async function workspaceNameFor(ctx: Awaited<ReturnType<typeof getData>>): Promise<string> {
  try {
    const view = await ctx.data.workspace.settings(ctx.actor);
    return view.view === "manager" ? view.settings.name : view.workspace.name;
  } catch {
    return "Roofy";
  }
}

/**
 * The app shell (DESIGN.md §4): tab bar on a phone, 240 px sidebar from 1024 px, an offline banner
 * and the "N to send" badge above the page. The demo state reaches this layout through the
 * `x-roofy-demo` header (`getData()` with no argument). It pads with the device's safe-area insets;
 * `--sat-sim` is the simulated inset the design guards set on iPhone captures.
 */
export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const ctx = await getData();
  const role = navRoleFor(ctx.actor.role);
  const waiting = ctx.demo.outbox.length;
  return (
    <div className="min-h-dvh lg:flex">
      <div className="hidden lg:sticky lg:top-0 lg:block lg:h-dvh lg:shrink-0 lg:overflow-y-auto">
        <ShellSidebar role={role} workspaceName={await workspaceNameFor(ctx)} />
      </div>
      <div
        className="flex min-w-0 flex-1 flex-col"
        style={{
          paddingTop: "max(var(--sat-sim, 0px), env(safe-area-inset-top))",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        {ctx.demo.offline ? <OfflineBanner /> : null}
        {waiting > 0 ? (
          <div className="flex justify-end px-4 pt-2">
            <OutboxBadge count={waiting} />
          </div>
        ) : null}
        <main className="flex-1 p-4 pb-tab-bar lg:pb-4">{children}</main>
      </div>
      <div className="lg:hidden">
        <ShellTabBar role={role} />
      </div>
    </div>
  );
}
