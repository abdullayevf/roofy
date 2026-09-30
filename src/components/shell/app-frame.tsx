import { OfflineBanner } from "@/components/offline-banner";
import { OutboxBadgeSlot } from "./outbox-badge-slot";
import { ShellSidebar, ShellTabBar } from "./nav-shell";
import type { NavRole } from "./active";

export type AppFrameProps = {
  role: NavRole;
  workspaceName: string;
  offline: boolean;
  /** Entries waiting to send ("N to send"). */
  waiting: number;
  /** Entries that failed and need attention ("N needs attention"). */
  attention: number;
  children: React.ReactNode;
};

/**
 * The app shell (DESIGN.md §4): tab bar on a phone, 240 px sidebar from 1024 px, an offline banner and the
 * outbox badge ("N to send", or "N needs attention") above the page. It pads with the device's safe-area insets; `--sat-sim` is the simulated
 * inset the design guards set on iPhone captures. Props only; the (app) layout passes the role and demo state.
 */
export function AppFrame({ role, workspaceName, offline, waiting, attention, children }: AppFrameProps) {
  return (
    <div className="min-h-dvh lg:flex">
      <div className="hidden lg:sticky lg:top-0 lg:block lg:h-dvh lg:shrink-0 lg:overflow-y-auto">
        <ShellSidebar role={role} workspaceName={workspaceName} outboxCount={waiting + attention} />
      </div>
      <div
        className="flex min-w-0 flex-1 flex-col"
        style={{
          paddingTop: "max(var(--sat-sim, 0px), env(safe-area-inset-top))",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        {offline ? <OfflineBanner /> : null}
        <OutboxBadgeSlot waiting={waiting} attention={attention} />
        <main className="flex-1 p-4 pb-tab-bar lg:pb-page">{children}</main>
      </div>
      <div className="lg:hidden">
        <ShellTabBar role={role} outboxCount={waiting + attention} />
      </div>
    </div>
  );
}
