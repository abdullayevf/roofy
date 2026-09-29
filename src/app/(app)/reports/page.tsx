import type { Metadata } from "next";
import type { SearchParams } from "@/data/session";
import { PlaceholderPage } from "../placeholder";

export const metadata: Metadata = { title: "Reports" };

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <PlaceholderPage
      section="reports"
      title="Reports"
      message="Reports will show here."
      actionLabel="Go to Home"
      actionHref="/"
      searchParams={searchParams}
    />
  );
}
