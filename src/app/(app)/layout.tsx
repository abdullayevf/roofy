import type { Metadata } from "next";
import { getData } from "@/data";
import { AppFrame } from "@/components/shell/app-frame";
import { navRoleFor } from "@/components/shell/access";

export const metadata: Metadata = {
  title: { template: "%s | Roofy", default: "Roofy" },
};

/** The workspace name for the sidebar; the context's own copy when the data can't be read (`?demo=error`, `?demo=noperm`). */
async function workspaceNameFor(ctx: Awaited<ReturnType<typeof getData>>): Promise<string> {
  try {
    const view = await ctx.data.workspace.settings(ctx.actor);
    return view.view === "manager" ? view.settings.name : view.workspace.name;
  } catch {
    return ctx.workspaceName;
  }
}

/** The app shell (`AppFrame`); the demo state reaches this layout through the `x-roofy-demo` header (`getData()` with no argument). */
export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const ctx = await getData();
  return (
    <AppFrame
      role={navRoleFor(ctx.actor.role)}
      workspaceName={await workspaceNameFor(ctx)}
      offline={ctx.demo.offline}
      waiting={ctx.demo.outbox.filter((i) => i.state !== "needs_attention").length}
      attention={ctx.demo.outbox.filter((i) => i.state === "needs_attention").length}
    >
      {children}
    </AppFrame>
  );
}
