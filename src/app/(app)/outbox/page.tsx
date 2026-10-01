import type { Metadata } from "next";
import { getData } from "@/data";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink, canOpen } from "@/components/shell/access";
import { OutboxError, OutboxScreen, OutboxSkeleton } from "@/components/screens/outbox-screen";

export const metadata: Metadata = { title: "Outbox" };

/** Outbox: every field entry waiting, sending, sent or needing attention. Prototype: the demo outbox. */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { actor, demo, today } = await getData({ searchParams });
  if (demo.loading) return <OutboxSkeleton />;
  if (demo.state === "error") return <OutboxError />;
  if (!canOpen(actor.role, "outbox") || demo.state === "noperm") {
    const back = backLink(actor.role);
    return <NoPermission backHref={back.href} backLabel={back.label} />;
  }
  const foreman = actor.role === "foreman";
  // A foreman is only ever sent the wording written for them.
  const items = foreman ? demo.outbox.map((i) => (i.rejection ? { ...i, rejection: { code: i.rejection.code, message: i.rejection.message } } : i)) : demo.outbox;
  return <OutboxScreen items={items} today={today} foreman={foreman} />;
}
