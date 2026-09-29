import type { Metadata } from "next";
import type { SearchParams } from "@/data/session";
import { PlaceholderPage } from "../placeholder";

export const metadata: Metadata = { title: "Crew" };

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <PlaceholderPage
      section="crew"
      title="Crew"
      message="Your crew will show here."
      actionLabel="Go to Home"
      actionHref="/"
      searchParams={searchParams}
    />
  );
}
