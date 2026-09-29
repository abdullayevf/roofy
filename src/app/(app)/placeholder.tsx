import { getData } from "@/data";
import type { SearchParams } from "@/data/session";
import { EmptyState } from "@/components/empty-state";
import { NoPermission } from "@/components/page-states";
import { backLink, canOpen, type Section } from "@/components/shell/access";

export type PlaceholderProps = {
  section: Section;
  title: string;
  message: string;
  actionLabel: string;
  actionHref: string;
  searchParams: Promise<SearchParams>;
};

/**
 * A stand-in for a screen a later task builds, so no nav link 404s. It already follows the shell's
 * rules: a role without access sees the no-permission state (also `?demo=noperm`), `?demo=error`
 * reaches the error boundary. Screen tasks replace the page and keep those two behaviours with
 * the pattern in `src/data/index.ts`.
 */
export async function PlaceholderPage({ section, title, message, actionLabel, actionHref, searchParams }: PlaceholderProps) {
  const { actor, demo } = await getData({ searchParams });
  if (demo.state === "error") throw new Error("Demo: this screen could not load.");
  if (!canOpen(actor.role, section) || demo.state === "noperm") {
    const back = backLink(actor.role);
    return <NoPermission backHref={back.href} backLabel={back.label} />;
  }
  return (
    <>
      <h1 className="font-display text-title text-ink">{title}</h1>
      <EmptyState message={message} actionLabel={actionLabel} href={actionHref} />
    </>
  );
}
