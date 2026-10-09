import type { Metadata } from "next";
import { getData } from "@/data";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink } from "@/components/shell/access";
import { CrewError, CrewListBody, CrewSkeleton } from "@/components/screens/crew-list";
import { loadCrew } from "./load-crew";

export const metadata: Metadata = { title: "Crew" };

/**
 * Crew list: who is on the crew and, for a manager, what each is owed. A foreman sees names, type and how each is
 * paid, no money, and can't open a person's page. An accountant has no crew page.
 *
 * Foreman access is kept on purpose (review CR2): the foreman nav (DESIGN.md) has no Crew entry, so they only
 * reach this by typing the address, and the names-only, money-free list it shows is within the spec.
 * Checked by `canOpen` in shell/access.test.ts (no nav entry) and tests/e2e/crew-list.spec.ts (foreman tests).
 */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getData({ searchParams });
  const { actor, demo } = ctx;
  const manager = actor.role === "owner" || actor.role === "manager";
  if (demo.loading) return <CrewSkeleton manager={manager} />;
  const back = backLink(actor.role);
  if (actor.role === "accountant") return <NoPermission backHref={back.href} backLabel={back.label} />;
  const show = manager && (await searchParams).show === "all" ? "all" : "active";
  const crew = await loadCrew(ctx, show === "all");
  if (crew.kind === "forbidden") return <NoPermission backHref={back.href} backLabel={back.label} />;
  if (crew.kind === "unavailable") return <CrewError manager={manager} filter={show} demo={demo.state ?? undefined} />;
  return <CrewListBody list={crew.list} filter={show} anyCrew={crew.anyCrew} today={ctx.today} demo={demo.state ?? undefined} />;
}
