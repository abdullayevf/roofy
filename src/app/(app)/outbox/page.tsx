import type { Metadata } from "next";
import { getData } from "@/data";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink, canOpen } from "@/components/shell/access";
import { OutboxScreen, OutboxSkeleton } from "@/components/screens/outbox-screen";

export const metadata: Metadata = { title: "Outbox" };

/** Outbox: every field entry waiting, sending, sent or needing attention. Prototype: the demo outbox. */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { actor, demo, today } = await getData({ searchParams });
  if (demo.loading) return <OutboxSkeleton />;
  if (demo.state === "error") throw new Error("Demo: this screen could not load.");
  if (!canOpen(actor.role, "outbox") || demo.state === "noperm") {
    const back = backLink(actor.role);
    return <NoPermission backHref={back.href} backLabel={back.label} />;
  }
  return <OutboxScreen items={demo.outbox} today={today} />;
}
