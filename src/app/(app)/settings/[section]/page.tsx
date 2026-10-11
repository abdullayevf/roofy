import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { SearchParams } from "@/data/session";
import { PlaceholderPage } from "../../placeholder";

export const metadata: Metadata = { title: "Settings" };

/** Stand-ins for the settings pages Task 19 run D builds, so no Settings row 404s. */
const LATER: Record<string, string> = {
  templates: "Templates",
  categories: "Expense categories",
  members: "Members & roles",
  assignments: "Foreman assignments",
};

export default async function Page({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<SearchParams> }) {
  const { section } = await params;
  const title = LATER[section];
  if (!title) notFound();
  return <PlaceholderPage section="settings" title={title} message={`${title} will show here.`} actionLabel="Back to Settings" actionHref="/settings" searchParams={searchParams} />;
}
